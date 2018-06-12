$(function () {
    var theme = "light";

    $("#wordsContainingInput").focus();
    $("#wordsContainingInput").keyup(function (event) {
        if (event.keyCode === 13) {
            $("#searchButton").click();
        }
    });

    /**
     * Handles the click event on the search button
     */
    $('#searchButton').on("click", function () {
        var words = $('#wordsContainingInput').val();
        var organisation = $('#organisationInput').val().trim();
        if(words.length > 0) {
            getSearchResult(words, organisation).then(function (result) {
                // Checks the data in the result for processing.
                if ("items" in result) {
                    if (result.items.length === 0) {
                        // Displays the message there are no results found.
                        $('#repo-search-result').empty();
                        no_search_result("No result found for the given word(s)", null, null, null, null);
                    } else {
                        // Displays the result
                        $('#repo-search-result').empty();
                        fill_search_result(result);
                    }
                } else {
                    if (result.message === "Rate limit exceeded") {
                        // Displays the rate limit has been exceeded, thus not able to search.
                        $('#repo-search-result').empty();
                        no_search_result(result.message, "Try again after " + result.waiting_time + " minutes!", null, result.rate_remaining, result.rate_limit);
                    }
                }
            })
        }else{
            // Displays text to insert words for no words given.
            no_search_result("Please insert (a) word(s) to look for!", null, null, null, null);
        }
    });

    /**
     * Handles the click event on the button to toggle the time from light to dark.
     */
    // $('#toggleThemeButton').on("click", function () {
    //     console.log("Theme is: " + theme);
    //     console.log($('#toggle_theme').attr("href"));
    //     if (theme === "light") {
    //         theme = "dark";
    //         $('#toggle_theme').attr("href", "{{url_for('.static', filename='css/user-friendly-dark.css')}}");
    //     }
    //     else {
    //         theme = "light";
    //         $('#toggle_theme').attr("href", "{{url_for('.static', filename='css/user-friendly-light.css')}}");
    //     }
    // });

    /**
     * places the home button according to the toggle theme button.
     */
    // $("#homeButton").attr("margin-left", (-10 - document.getElementById('toggleThemeButton').offsetWidth) + "px");

    /**
     * function to loop through the data returned in order to display it on the page.
     */
    function loopQueryDataReturned(queryData, headers, elementToAppendTo) {
        var tableRow = document.createElement('tr');
        elementToAppendTo.appendChild(tableRow);
        $.each(queryData, function (k, v) {
            if (headers.includes(k)) {
                for (var i = 0; i < headers.length; i++) {
                    if (headers[i] === k) {
                        var tableData = document.createElement('td');
                        tableData.textContent = v['value'];
                        tableRow.appendChild(tableData);
                    }
                }
            } else {
                loopQueryDataReturned(v, headers, elementToAppendTo);
            }
        });
    }

    /**
     * Executes the query given with an ajax call.
     * Depending on the output of the ajax call it handles the output and displays it on the page.
     */
    function executeQuery(fileName, repoUrl, sha, user, div, execute_button, summary) {
        /** Ajax way of getting the data of the query */
        var splittedUrl = repoUrl.split("/");
        var repo = splittedUrl.slice(-1)[0];
        var url = "/api/" + user + "/" + repo + "/" + fileName.replace(/\.[^/.]+$/, "");
        // Calls the function <function> from the server
        $.ajax({
            type: "GET",
            url: url,
            dataType: "json",
            beforeSend: function () {
                execute_button.textContent = "Running...";
            },
            complete: function () {
                execute_button.textContent = "Run Query";
            },
            success: function (dataReturned) {
                $(div).empty();
                /** With jquery it might work */
                if (false) { // Just for trying out without the result viewable without downloading.
                    var headers = dataReturned['head']['vars'];
                    var data = dataReturned['results']['bindings'];
                    var returned_data_table = document.createElement('table');
                    var tableHead = document.createElement('thead');
                    var headerRow = document.createElement('tr');
                    var tableBody = document.createElement('tbody');
                    returned_data_table.appendChild(tableHead);
                    tableHead.appendChild(headerRow);
                    for (var i = 0; i < headers.length; i++) {
                        var head = document.createElement('th');
                        head.textContent = headers[i];
                        headerRow.appendChild(head);
                    }
                    returned_data_table.appendChild(tableBody);
                    returned_data_table.setAttribute('class', 'table table-striped table-bordered table-condensed');

                    $.each(data, function (key, value) {
                        loopQueryDataReturned(value, headers, tableBody);
                    });

                    var returned_data_table_container = document.createElement('div');
                    returned_data_table_container.setAttribute('class', 'returned-data-table-container');

                    div.appendChild(returned_data_table_container);
                    returned_data_table_container.appendChild(returned_data_table);
                }

                var returned_data_export_container = document.createElement('div');
                returned_data_export_container.setAttribute('class', 'returned-data-export-container');

                // Creation of the label displaying the data is available.
                var returned_data_available_label = document.createElement('label');
                returned_data_available_label.innerHTML = "Query data available for download. Select one of the following download options.";
                returned_data_available_label.setAttribute('class', 'returned_data_export_label');
                returned_data_export_container.appendChild(returned_data_available_label);

                // Creation of the button for downloading the data as a JSON file.
                var convert_to_json_button = document.createElement('a');
                convert_to_json_button.className = "btn btn-primary repo-search-result-data-convert-button";
                convert_to_json_button.href = 'data:text/json;charset=utf-8,' + JSON.stringify(dataReturned, null, '\t');
                convert_to_json_button.target = '_blank';
                convert_to_json_button.download = summary + '.json';
                convert_to_json_button.textContent = "Save as JSON";
                //console.log(JSON.stringify(dataReturned, null, '\t'));
                returned_data_export_container.appendChild(convert_to_json_button);

                // Creation of the button for downloading the data as a CSV file.
                var convert_to_csv_button = document.createElement('a');
                convert_to_csv_button.className = "btn btn-primary repo-search-result-data-convert-button";
                convert_to_csv_button.href = 'data:attachment/csv,' + exportToCSV(dataReturned);
                convert_to_csv_button.target = '_blank';
                convert_to_csv_button.download = summary + '.csv';
                convert_to_csv_button.textContent = "Save as CSV";
                returned_data_export_container.appendChild(convert_to_csv_button);

                // Creation of the button for downloading the data as a XML file.
                var convert_to_xml_button = document.createElement('a');
                convert_to_xml_button.className = "btn btn-primary repo-search-result-data-convert-button";
                convert_to_xml_button.href = 'data:text/xml,' + exportToXML(dataReturned, summary);
                convert_to_xml_button.target = '_blank';
                convert_to_xml_button.download = summary + '.xml';
                convert_to_xml_button.textContent = "Save as XML";
                returned_data_export_container.appendChild(convert_to_xml_button);

                // Appending the container element with all other elements present to the main container.
                div.appendChild(returned_data_export_container);
            }
        })
    }

    /**
     * Function to export the data gathered from the query as a XML file.
     */
    function exportToXML(dataReturned, summary) {
        var headers = dataReturned['head']['vars'];
        var data = dataReturned['results']['bindings'];
        var xml_string = '<?xml version="1.0" encoding="UTF-8"?>';
        xml_string += "<result>";
        xml_string += "<summary>";
        xml_string += "" + summary + "";
        xml_string += "</summary>";
        xml_string += "<items>";
        for (var i = 0; i < data.length; i++) {
            xml_string += "<item>";
            for (var j = 0; j < headers.length; j++) {
                xml_string += "<" + headers[j] + ">";
                xml_string += "" + data[i][headers[j]]["value"] + "";
                xml_string += "</" + headers[j] + ">";
            }
            xml_string += "</item>";
        }
        xml_string += "</items>";
        xml_string += "</result>";
        return xml_string;
    }

    /**
     * Function to export the data gathered from the query as a CSV file.
     */
    function exportToCSV(dataReturned) {
        var headers = dataReturned['head']['vars'];
        var data = dataReturned['results']['bindings'];
        var csvHeader = [headers];
        for (var i = 0; i < data.length; i++) {
            var row = [];
            for (var j = 0; j < headers.length; j++) {
                row.push(data[i][headers[j]]["value"]);
            }
            csvHeader.push(row);
        }
        var csvRows = [];
        for (var x = 0, l = csvHeader.length; x < l; x++) {
            csvRows.push(csvHeader[x].join(';'));
        }
        return csvRows.join("%0a");
    }

    /**
     * Function to check the rate limit for searching github.
     * This to see whether it is possible to search for subjects.
     */
    function checkRateLimit() {
        $.ajax({
            url: "https://api.github.com/rate_limit",
            type: "GET",
            dataType: 'json',
            cache: false,
        }).done(function (data) {
            // console.log(data);
            // console.log(data.rate.remaining);
            return data.rate.remaining > 10;
        });
    }

    /*function checkAbleToRequestSearch() {
        var url_to_surf_to = "/user-friendly/rate_limit";
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.onload = function () {
                console.log(this);
                console.log(this.response);
                console.log(this.responseText);
                resolve(this.responseText);
            };
            xhr.onerror = reject;
            xhr.open('GET', url_to_surf_to);
            xhr.send();
        });
    }*/

    /*function searchGithub(words, organisation) {
        if (checkRateLimit() === false) {
            var wordslookingfor = "";
            for (var i = 0; i < words.length; i++) {
                wordslookingfor += words[i] + "+in:file+";
            }
            wordslookingfor += "language:sparql+";
            wordslookingfor += "org:" + organisation;
            $.ajax({
                url: "https://api.github.com/search/code?q=" + wordslookingfor,
                type: "GET",
                dataType: 'json',
                cache: true,
                success: function (data, status, error) {
                    console.log('success', data);
                    $('#repo-search-result').empty();
                    fill_search_result(data);
                },
                error: function (data, status, error) {
                    console.log('error', data, status, error);
                }
            }).done(function (data) {
                if (data.items.length === 0) {
                    no_search_result();
                }
            });
        }
    }*/

    /**
     * Function to get the result of the search from the words provided in the search field.
     */
    function getSearchResult(words, organisation) {
        var url_to_surf_to = "/user-friendly/search/" + words + "/" + organisation;
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.onload = function () {
                resolve(JSON.parse(this.responseText));
            };
            xhr.onerror = reject;
            xhr.open('GET', url_to_surf_to);
            xhr.send();
        });
    }

    /**
     * Function to get the rate limit for searching on github.
     */
    function getRateLimit() {
        var url_to_surf_to = "/user-friendly/rate_limit";
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.onload = function () {
                resolve(JSON.parse(this.responseText));
            };
            xhr.onerror = reject;
            xhr.open('GET', url_to_surf_to);
            xhr.send();
        });
    }

    /**
     * Function to get the file information of the file given.
     * This by looking on github for the data present in the file searched.
     */
    function getFileInformation(givenData) {
        var file_to_surf_to = givenData['repository']['full_name'];
        //var sha = givenData['sha'];
        var file_name = givenData['name'];
        var url_to_surf_to = "/collect-data/" + file_to_surf_to + "/" + file_name;
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.onload = function () {
                resolve(JSON.parse(this.responseText));
            };
            xhr.onerror = reject;
            xhr.open('GET', url_to_surf_to);
            xhr.send();
        });
    }

    /**
     * Function to display text for when there is no search result available.
     * This is done by displaying buttons and headers with information.
     */
    function no_search_result(no_result_text, rate_exceeded_text, time_remaining, rate_remaining, rate_limit) {
        var div_to_add_to = document.getElementById("repo-search-result");
        var no_result_element = document.createElement('h3');
        no_result_element.innerHTML = no_result_text;
        div_to_add_to.append(no_result_element);
        if (rate_exceeded_text !== null) {
            var rate_exceeded_element = document.createElement('h4');
            rate_exceeded_element.innerHTML = rate_exceeded_text;
            div_to_add_to.append(rate_exceeded_element);
            var rate_remaining_element = document.createElement('h4');
            rate_remaining_element.innerHTML = "Number of requests remaining: " + rate_remaining + " of " + rate_limit;
            div_to_add_to.append(rate_remaining_element);
            var refresh_button = document.createElement('button');
            refresh_button.textContent = "Refresh";
            refresh_button.setAttribute('class', 'btn btn-success repo-search-result-item-execute_button');
            div_to_add_to.append(refresh_button);
            refresh_button.addEventListener("click", function () {
                getRateLimit().then(function (result) {
                    $('#repo-search-result').empty();
                    no_search_result(result.message, "Try again after " + result.waiting_time + " minutes!", null, result.rate_remaining, result.rate_limit);
                })
            });
        }
        if (time_remaining !== null) {
            var rate_time_remaining = document.createElement('h4');
            rate_time_remaining.innerHTML = time_remaining;
            div_to_add_to.append(rate_time_remaining);
        }
    }

    /**
     * Function to fill in the data gathered from the search result.
     * This includes displaying the links to github & yasgui.
     */
    function fill_search_result(data) {
        $.each(data, function () {
            $.each(this, function (k, v) {
                /** Creation and filling of the search results */
                var div_to_add_to = document.getElementById("repo-search-result");
                var item_div = document.createElement("div");
                item_div.setAttribute('class', 'repo-search-result-item');

                var item_header_div = document.createElement('div');
                item_header_div.setAttribute('class', 'repo-search-result-item-header');

                var item_body_div = document.createElement('div');
                item_body_div.setAttribute('id', v["sha"]);
                //item_body_div.setAttribute('class', 'collapse');

                var item_content_div = document.createElement('div');
                item_content_div.setAttribute('class', 'repo-search-result-item-body');

                var div_to_display_data = document.createElement("div");
                div_to_display_data.setAttribute("class", "repo-search-result-data-container");

                item_body_div.appendChild(item_content_div);
                item_div.appendChild(item_header_div);
                item_div.appendChild(item_body_div);
                div_to_add_to.appendChild(item_div);

                var yasgui_button = document.createElement('button');
                var summary_label = document.createElement('label');
                var execute_button = document.createElement('button');
                var yasgui_form = document.createElement('form');
                yasgui_form.setAttribute('method', "post");
                yasgui_form.setAttribute('action', "/yasgui");
                yasgui_form.setAttribute('role', "form");
                yasgui_form.setAttribute('target', "_blank");
                var yasgui_input = document.createElement('input');
                yasgui_input.setAttribute('class', 'repo-search-result-yasgui-input');
                yasgui_input.setAttribute('name', 'yasgui_query');

                getFileInformation(v).then(function (result) {
                    summary_label.textContent = "Summary: " + result["items"][0]["summary"];
                    yasgui_input.setAttribute('value', encodeURIComponent(result["items"][0]["query"]));
                    execute_button.addEventListener("click", function () {
                        executeQuery(v['name'], v['repository']['url'], v['sha'], v['repository']['owner']['login'], div_to_display_data, execute_button, result["items"][0]["summary"]);
                    });
                })
                    .catch(function () {
                        summary_label.textContent = "No summary detected!";
                    });

                summary_label.setAttribute('class', 'repo-search-result-item-summary-label');
                summary_label.textContent = "Summary: Loading...";

                var url_link = document.createElement('a');
                url_link.setAttribute('class', 'btn btn-info repo-search-result-item-url_link');
                url_link.setAttribute('href', v['html_url']);
                url_link.setAttribute('target', 'blank');
                url_link.textContent = "Repository information";

                var execute_div = document.createElement('div');
                execute_div.setAttribute('class', 'repo-search-result-execute-container');

                execute_button.textContent = "Run Query";
                execute_button.setAttribute('class', 'btn btn-success repo-search-result-item-execute_button');

                yasgui_form.appendChild(yasgui_button);
                yasgui_form.appendChild(yasgui_input);
                execute_div.appendChild(execute_button);
                execute_div.appendChild(yasgui_form);

                yasgui_button.textContent = "Open Query in Yasgui";
                yasgui_button.setAttribute('class', 'btn btn-success repo-search-result-item-execute_button');

                //item_header_div.appendChild(collapse_item_button);
                item_header_div.appendChild(summary_label);
                item_content_div.appendChild(url_link);
                item_content_div.appendChild(execute_div);
                item_content_div.appendChild(div_to_display_data);
            });
        });
    }
});