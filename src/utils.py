import static as static
import gquery as gquery
import requests
import time
import cgi
from rdflib import Graph
import traceback

import logging

from fileLoaders import GithubLoader, LocalLoader

glogger = logging.getLogger(__name__)

def turtleize(swag):
    '''
    Transforoms a JSON swag object into a text/turtle LDA equivalent representation
    '''
    swag_graph = Graph()

    return swag_graph.serialize(format='turtle')

def build_spec(user, repo, sha=None, prov=None, extraMetadata=[]):
    '''
    Build grlc specification for the given github user / repo
    '''
    if user is None and repo is None:
        loader = LocalLoader()
    else:
        loader = GithubLoader(user, repo, sha, prov)

    files = loader.fetchFiles()
    raw_repo_uri = loader.getRawRepoUri()

    # Fetch all .rq files
    items = []

    for c in files:
        c_name = c['name']
        print '>>>>>>>>>>>>>>>>>>>>>>>>>c_name: ', c_name
        if ".rq" in c['name'] or ".tpf" in c['name'] or ".sparql" in c['name']:
            call_name = c['name'].split('.')[0]

            # Retrieve extra metadata from the query decorators
            query_text = loader.getTextFor(c)

            item = None
            if ".rq" in c_name or ".sparql" in c_name:
                glogger.info("===================================================================")
                glogger.info("Processing SPARQL query: {}".format(c_name))
                glogger.info("===================================================================")
                item = process_sparql_query_text(query_text, raw_repo_uri, call_name, extraMetadata)
            elif ".tpf" in c['name']:
                glogger.info("===================================================================")
                glogger.info("Processing TPF query: {}".format(c_name))
                glogger.info("===================================================================")
                item = process_tpf_query_text(query_text, raw_repo_uri, call_name, extraMetadata)
            else:
                glogger.info("Ignoring unsupported source call name: {}".format(c_name))
            if item:
                items.append(item)
    return items

def process_tpf_query_text(query_text, raw_repo_uri, call_name, extraMetadata):
    query_metadata = gquery.get_yaml_decorators(query_text)

    tags = query_metadata['tags'] if 'tags' in query_metadata else []
    glogger.debug("Read query tags: " + ', '.join(tags))

    summary = query_metadata['summary'] if 'summary' in query_metadata else ""
    glogger.debug("Read query summary: " + summary)

    description = query_metadata['description'] if 'description' in query_metadata else ""
    glogger.debug("Read query description: " + description)

    method = query_metadata['method'].lower() if 'method' in query_metadata else "get"
    if method not in ['get', 'post', 'head', 'put', 'delete', 'options', 'connect']:
        method = "get"

    pagination = query_metadata['pagination'] if 'pagination' in query_metadata else ""
    glogger.debug("Read query pagination: " + str(pagination))

    # enums = query_metadata['enumerate'] if 'enumerate' in query_metadata else []
    # glogger.debug("Read query enumerates: " + ', '.join(enums))

    endpoint = query_metadata['endpoint'] if 'endpoint' in query_metadata else ""
    glogger.debug("Read query endpoint: " + endpoint)

    # If this query allows pagination, add page number as parameter
    params = []
    if pagination:
        pagination_param = {}
        pagination_param['name'] = "page"
        pagination_param['type'] = "int"
        pagination_param['in'] = "query"
        pagination_param['description'] = "The page number for this paginated query ({} results per page)".format(pagination)
        params.append(pagination_param)

    item = {
        'call_name': call_name,
        'method': method,
        'tags': tags,
        'summary': summary,
        'description': description,
        'params': params,
        'query': query_metadata['query']
    }

    for extraField in extraMetadata:
        if extraField in query_metadata:
            item[extraField] = query_metadata[extraField]

    return item

def process_sparql_query_text(query_text, raw_repo_uri, call_name, extraMetadata):
    # We get the endpoint name first, since some query metadata fields (eg enums) require it
    endpoint, auth = gquery.guess_endpoint_uri(query_text, raw_repo_uri)
    glogger.debug("Read query endpoint: {}".format(endpoint))

    try:
        query_metadata = gquery.get_metadata(query_text, endpoint)
    except Exception as e:
        raw_query_uri = raw_repo_uri + ' / ' + call_name
        glogger.error("Could not parse query at {}".format(raw_query_uri))
        glogger.error(traceback.print_exc())
        return None

    #glogger.debug("Query metadata: {}".format(query_metadata))

    tags = query_metadata['tags'] if 'tags' in query_metadata else []
    #glogger.debug("Read query tags: {}".format(', '.join(tags)))

    summary = query_metadata['summary'] if 'summary' in query_metadata else ""
    #glogger.debug("Read query summary: {}".format(summary))

    description = query_metadata['description'] if 'description' in query_metadata else ""
    #glogger.debug("Read query description: {}".format(description))

    method = query_metadata['method'].lower() if 'method' in query_metadata else ""
    if method not in ['get', 'post', 'head', 'put', 'delete', 'options', 'connect']:
        method = ""

    pagination = query_metadata['pagination'] if 'pagination' in query_metadata else ""
    #glogger.debug("Read query pagination: {}".format(pagination))

    # enums = query_metadata['enumerate'] if 'enumerate' in query_metadata else []
    # glogger.debug("Read query enumerates: {}".format(', '.join(enums)))

    mime = query_metadata['mime'] if 'mime' in query_metadata else ""
    #glogger.debug("Read endpoint dump MIME type: {}".format(mime))


    # Processing of the parameters
    params = []

    # PV properties
    item_properties = {}

    # If this query allows pagination, add page number as parameter
    if pagination:
        pagination_param = {}
        pagination_param['name'] = "page"
        pagination_param['type'] = "int"
        pagination_param['in'] = "query"
        pagination_param['description'] = "The page number for this paginated query ({} results per page)".format(pagination)
        params.append(pagination_param)

    if query_metadata['type'] == 'SelectQuery' or query_metadata['type'] == 'ConstructQuery' or query_metadata['type'] == 'InsertData':
        # try:
        #     parameters = gquery.get_parameters(query_text, endpoint)
        # except Exception as e:
        #     glogger.error(e)
        #     glogger.error("Could not parse parameters of query {}".format(call_name))
        #     return None

        # glogger.debug("Read request parameters")
        # glogger.debug(parameters)
        # TODO: do something intelligent with the parameters!
        # As per #3, prefetching IRIs via SPARQL and filling enum
        parameters = query_metadata['parameters']

        for v, p in list(parameters.items()):
            param = {}
            param['name'] = p['name']
            param['type'] = p['type']
            param['required'] = p['required']
            param['in'] = "query"
            param['description'] = "A value of type {} that will substitute {} in the original query".format(p['type'], p['original'])
            if p['enum']:
                param['enum'] = p['enum']

            params.append(param)

    if query_metadata['type'] == 'SelectQuery':
        # Fill in the spec for SELECT
        if not method:
            method = 'get'
        # item['item_properties'] = {}
        for pv in query_metadata['variables']:
            item_properties[pv] = {
                "name": pv,
                "type": "object",
                "required": ["type", "value"],
                "properties": {
                    "type": {
                        "type": "string"
                    },
                    "value": {
                        "type": "string"
                    },
                    "xml:lang": {
                        "type": "string"
                    },
                    "datatype": {
                        "type": "string"
                    }
                }
            }

    elif query_metadata['type'] == 'ConstructQuery':
        if not method:
            method = 'get'
    elif query_metadata['type'] == 'UNKNOWN':
        glogger.warning("grlc could not parse this query; assuming a plain, non-parametric SELECT in the API spec")
        if not method:
            method = 'get'
    else:
        glogger.warning("Query of type {} is currently unsupported! Skipping".format(query_metadata['type']))

    # Finally: main structure of the callname spec
    item = {
        'call_name': call_name,
        'method': method,
        'tags': tags,
        'summary': summary,
        'description': description,
        'params': params,
        'item_properties': None, # From projection variables, only SelectQuery
        'query': query_metadata['query']
    }

    # else:
        # TODO: process all other kinds of queries
        # if not method:
        #     method = 'post'
        # item = {
        #     'call_name': call_name,
        #     'method': method,
        #     'tags': tags,
        #     'summary': summary,
        #     'description': description,
        #     'query': query_metadata['query']
        # }

    for extraField in extraMetadata:
        if extraField in query_metadata:
            item[extraField] = query_metadata[extraField]

    return item

def build_swagger_spec(user, repo, sha, serverName, prov, gh_repo):
    '''Build grlc specification for the given github user / repo in swagger format '''
    if user is None and repo is None:
        user_repo = 'local/local'
        prev_commit = []
        next_commit = []
        version = 'local'
        repo_title = 'local'
        contact_name = ''
        contact_url = ''
    else:
        user_repo = user + '/' + repo
        api_repo_uri = static.GITHUB_API_BASE_URL + user_repo

        repo_title = gh_repo.name
        contact_name = gh_repo.owner.login
        contact_url = gh_repo.owner.html_url

        # Add the API URI as a used entity by the activity
        if prov is not None:
            prov.add_used_entity(api_repo_uri)

        commit_list = [ c.sha for c in gh_repo.get_commits() ]

        prev_commit = None
        next_commit = None

        version = sha
        if sha is None:
            version = commit_list[0]

        if commit_list.index(version) < len(commit_list) - 1:
            prev_commit = commit_list[commit_list.index(version)+1]
        if commit_list.index(version) > 0:
            next_commit = commit_list[commit_list.index(version)-1]

    swag = {}
    swag['prev_commit'] = prev_commit
    swag['next_commit'] = next_commit
    swag['swagger'] = '2.0'
    swag['info'] = {
        'version': version,
        'title': repo_title,
        'contact': {
            'name': contact_name,
            'url': contact_url
        },
        'license': {
            'name' : 'License',
            'url': static.GITHUB_RAW_BASE_URL + user_repo + '/master/LICENSE'
        }
    }
    swag['host'] = serverName
    swag['basePath'] = '/api/' + user_repo + '/'
    if sha is not None:
        swag['basePath'] = '/api/' + user_repo + '/commit/' + sha + '/'
    swag['schemes'] = ['http']
    swag['paths'] = {}

    spec = build_spec(user, repo, sha, prov)
    # glogger.debug("Current internal spec data structure")
    # glogger.debug(spec)
    for item in spec:
        swag['paths'][item['call_name']] = {}
        swag['paths'][item['call_name']][item['method']] = {
            "tags" : item['tags'],
            "summary" : item['summary'],
            "description" : item['description'] + "\n<pre>\n{}\n</pre>".format(cgi.escape(item['query'])),
            "produces" : ["text/csv", "application/json", "text/html"],
            "parameters": item['params'] if 'params' in item else None,
            "responses": {
                "200" : {
                    "description" : "Query response",
                    "schema" : {
                        "type" : "array",
                        "items": {
                            "type": "object",
                            "properties": item['item_properties'] if 'item_properties' in item else None
                        },
                    }
                },
                "default" : {
                    "description" : "Unexpected error",
                    "schema" : {
                        "$ref" : "#/definitions/Message"
                    }
                }
            }
        }
    return swag

# Collects the data needed for the user friendly part of the application.
# This includes data about queries uploaded on github.
def build_swagger_spec_user_friendly(user, repo, file, sha, prov):
    data = {}
    data["user"] = user
    data["repo"] = repo

    spec = build_spec_user_friendly(user, repo,file, sha, prov)

    data["items"] = []
    for item in spec:
        d = {}

        d["tags"] = item['tags']
        d["call_name"] = item['call_name']
        d["summary"] = item['summary']
        # d["description"] = item['description'] + "\n<pre>\n{}\n</pre>".format(cgi.escape(item['query']))
        d["description"] = item['description']
        d["produces"] = ["text/csv", "application/json", "text/html"]
        d["parameters"] = item['params'] if 'params' in item else None
        d["query"] = item['query']
        data["items"].append(d)
    return data

# Searches github based on the data given for the search.
def search_github(type_of_search, variables, organisation):
    variables = variables.split(',')
    words_to_look_for = ""
    for word in variables:
        words_to_look_for += word + "+in:file+"
    words_to_look_for += "language:sparql+"
    words_to_look_for += "org:" + organisation
    api_repo_uri = static.GITHUB_API_URL + type_of_search + '/code?q=' + words_to_look_for
    resp = requests.get(api_repo_uri, headers={'Authorization': 'token {}'.format(static.ACCESS_TOKEN)}).json()

    return resp

# Gets the rate limit for the application based on the token provided for the application.
def get_rate_limit():
    api_rate_limit_uri = static.GITHUB_RATE_LIMIT_URL
    rate_limit_result = requests.get(api_rate_limit_uri, headers={'Authorization': 'token {}'.format(static.ACCESS_TOKEN)}).json()
    return rate_limit_result["rate"]["remaining"]

# Gets the rate limit information, including time untill refill and times to search left.
def get_rate_limit_reset_data():
    api_rate_limit_uri = static.GITHUB_RATE_LIMIT_URL
    rate_limit_result = requests.get(api_rate_limit_uri, headers={'Authorization': 'token {}'.format(static.ACCESS_TOKEN)}).json()

    reset_milliseconds = rate_limit_result["rate"]["reset"]
    rate_limit = rate_limit_result["rate"]["limit"]
    rate_remaining = rate_limit_result["rate"]["remaining"]
    millis = int(round(time.time()))
    time_to_wait = reset_milliseconds - millis
    time_to_wait = time_to_wait / 60

    data = {}
    data['message'] = 'Rate limit exceeded'
    data['waiting_time'] = time_to_wait
    data['rate_remaining'] = rate_remaining
    data['rate_limit'] = rate_limit
    return data

# Returns the data for the user friendly side of the application.
# This concludes data off the queries looked for on github.
def build_spec_user_friendly(user, repo, file, sha, prov, extraMetadata=[]):
    '''
    Build grlc specification for the given github user / repo
    '''
    api_repo_uri = static.GITHUB_API_BASE_URL + user + '/' + repo #+ '/' + file # either here or after contents
    api_repo_content_uri = api_repo_uri + '/contents' + '/' + file

    params = {'ref' : 'master'}
    if sha is not None:
        params = {'ref' : sha}

    resp = requests.get(api_repo_content_uri, headers={'Authorization': 'token {}'.format(static.ACCESS_TOKEN)}, params=params).json()

    # glogger.debug(resp)
    raw_repo_uri = static.GITHUB_RAW_BASE_URL + user + '/' + repo + '/master/'
    if sha is not None:
        raw_repo_uri = static.GITHUB_RAW_BASE_URL + user + '/' + repo + '/blob/{}/'.format(sha)
    # Fetch all .rq files
    items = []
    resp_new = []
    resp_new.append(resp)

    for c in resp_new:
        if ".rq" in c['name'] or ".tpf" in c['name'] or ".sparql" in c['name']:
            call_name = c['name'].split('.')[0]
            # Retrieve extra metadata from the query decorators
            raw_query_uri = c['download_url']
            resp_new = requests.get(raw_query_uri, headers={'Authorization': 'token {}'.format(static.ACCESS_TOKEN)}).text

            # Add query URI as used entity by the logged activity
            prov.add_used_entity(raw_query_uri)

            item = None
            if ".rq" in c['name'] or ".sparql" in c['name']:
                item = process_sparql_query_text(resp_new, raw_repo_uri, call_name, extraMetadata)
            elif ".tpf" in c['name']:
                item = process_tpf_query_text(resp_new, raw_repo_uri, call_name, extraMetadata)
            if item:
                items.append(item)
    return items


