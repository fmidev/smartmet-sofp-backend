import {Backend, Collection, Link, Query, FeatureStream, Feature, Item, Filter} from 'sofp-lib';

import * as _ from 'lodash';

let SofpSmartmetBackend = new Backend('SofpSmartmetBackend');

// Load configuration file

const fs = require('fs');
var readStream = fs.createReadStream('cnf/smartmet.json');
var buf = '';

readStream.on('data', (chunk) => {
    buf += chunk;
}).on("end", () => {
    try {
        var conf = JSON.parse(buf);

        // Server url

        if ((!_.has(conf, 'server')) || (!_.isString(conf.server)) || (conf.server == '')) {
            throw new Error('server: smartmet server url missing or invalid');
        }
        var server = conf.server;

	// Default locations for enumerable data

        var defaultLocation = '&keyword=ajax_fi_all';
        if (_.has(conf, 'defaultlocation')) {
            if ((!_.isString(conf.defaultlocation)) || (conf.defaultlocation == '')) {
                throw new Error('defaultlocation: Default location must be a nonempty string');
            }

            defaultLocation = conf.defaultlocation;
        }

        // Innumerable data producers

        if (_.has(conf, 'innumerabledataproducers')) {
            if (!_.isArray(conf.innumerabledataproducers)) {
                throw new Error('Producer names must be an array of nonempty strings');
            }

            conf.innumerabledataproducers.forEach( (producer) => {
                if ((!_.isString(producer)) || (producer == '')) {
                    throw new Error('innumerabledataproducers: Producer names must be nonempty strings');
                }

                SofpSmartmetBackend.collections.push(new GeoJSONCollection(producer,
                                                                          producer + ' data by FMI',
                                                                          server,
                                                                          producer,
                                                                          '',
                                                                          false));
            });
        }

        // Enumerable data producers

        if (_.has(conf, 'enumerabledataproducers')) {
            if (!_.isArray(conf.enumerabledataproducers)) {
                throw new Error('enumerabledataproducers: Producer names must be an array of nonempty strings');
            }

            conf.enumerabledataproducers.forEach( (producer) => {
                if ((!_.isString(producer)) || (producer == '')) {
                    throw new Error('Producer names must be nonempty strings');
                }

                SofpSmartmetBackend.collections.push(new GeoJSONCollection(producer,
                                                                          producer + ' data by FMI',
                                                                          server,
                                                                          producer,
                                                                          defaultLocation,
                                                                          true));
            });
        }

        if (SofpSmartmetBackend.collections.length == 0) {
            throw new Error('No producers');
        }
    }
    catch (err) {
        console.error("Error loading configuration: " + err.message);
    }
}).on("error", (err) => {
    console.error("Error loading configuration: " + err.message);
});

interface GeoJSONGeometry {
    type : string;
    coordinates : Number[];
};

interface GeoJSONFeature {
    type : string;
    properties : { gml_id: String };
    geometry: GeoJSONGeometry;
};

interface GeoJSONFeatureCollection {
    type: string;
    name: string;
    crs: object;
    features: GeoJSONFeature[];
};

interface DataRequestParameter {
    parameterName : String;
    propertyName : String;
    groupName : String;
    filterFunction : Function;
    required : Boolean;
};

class GeoJSONCollection implements Collection {
    name : string;
    description : string;
    links : Link[] = [];

    server : string;
    producer : string;
    enumerable : boolean;
    defaultLocation : string;
    data : GeoJSONFeatureCollection;

    constructor(name, description, server, producer, defaultLocation, enumerable) {
        this.name = name;
        this.description = description;
        this.server = server;
        this.producer = producer;
        this.defaultLocation = defaultLocation;
        this.enumerable = enumerable;
    }

    executeQuery(query : Query) : FeatureStream {
        var ret = new FeatureStream();
        ret.remainingFilter = query.filters.slice();
        var nextToken = Number(query.nextToken || '0');

        class RequiredDataRequestParameter implements DataRequestParameter {
            parameterName : String;
            propertyName : String;
            groupName : String;
            filterFunction : Function;
            required : Boolean;

            constructor(parameterName : String, propertyName : String, filterFunction : Function) {
                this.parameterName = parameterName;
                this.propertyName = propertyName;
                this.filterFunction = filterFunction;
                this.required = true;
            }
        }
        class RequiredGroupDataRequestParameter implements DataRequestParameter {
            parameterName : String;
            propertyName : String;
            groupName : String;
            filterFunction : Function;
            required : Boolean;

            constructor(groupName : String, parameterName : String, propertyName : String, filterFunction : Function) {
                this.parameterName = parameterName;
                this.propertyName = propertyName;
                this.groupName = groupName;
                this.filterFunction = filterFunction;
                this.required = true;
            }
        }
        class OptionalDataRequestParameter implements DataRequestParameter {
            parameterName : String;
            propertyName : String;
            groupName : String;
            filterFunction : Function;
            required : Boolean;

            constructor(groupName : String, parameterName : String, propertyName : String, filterFunction : Function) {
                this.parameterName = parameterName;
                this.propertyName = propertyName;
                this.filterFunction = filterFunction;
                this.required = false;
            }
        }
        function extractDataQueryParameters(collection : GeoJSONCollection, queryFilters, nextTokenRow, paramMap) : String {
            function extractPropertyFilter(requestParameter, queryFilters, paramMap) : String {
                var filter = requestParameter.parameterName;
                var nElem = (filter.indexOf("=") < (filter.length - 1)) ? 1 : 0;
                var propFilter : Filter = _.find(queryFilters, { filterClass: 'PropertyFilter' });

                if (propFilter && (_.keys(propFilter.parameters.properties).indexOf(requestParameter.propertyName) >= 0)) {
                    // To handle request with same data parameter multiple times, collect parameter names into a map with unique alias name
                    //
                    if (requestParameter.propertyName == 'parametername') {
                        _.forEach(decodeURIComponent(propFilter.parameters.properties[requestParameter.propertyName]).split(','), (param) => {
                            var alias = param +'_p' + String(Object.keys(paramMap).length + 1);
                            paramMap[alias] = param;
                            filter += (((nElem++ == 0) ? "" : ",") + encodeURIComponent(param) + ' as ' + alias);
                        });
                    }
                    else {
                        filter += ((nElem++ == 0) ? "" : ",") + encodeURIComponent(propFilter.parameters.properties[requestParameter.propertyName]);
                    }

                    delete propFilter.parameters.properties[requestParameter.propertyName];

                    return filter;
                }
            }
            function extractTimeFilter(requestParameter, queryFilters) : String {
                var propFilter : Filter = _.find(queryFilters, { filterClass: 'TimeFilter' });

                if (propFilter) {
                    queryFilters.splice(queryFilters.indexOf(propFilter), 1);
 
                    if (propFilter.parameters.momentStart.isSame(propFilter.parameters.momentEnd)) {
                        return "&starttime=" + propFilter.parameters.momentStart.utc().format();
                    }
                    else {
                        return "&starttime=" + propFilter.parameters.momentStart.utc().format() +
                               "&endtime=" + propFilter.parameters.momentEnd.utc().format();
                    }
                }
            }
            function pointsWithinBBOX(BBOXCorners : number[]) : String {
                // Return evenly spaced points within the bbox
                //
                var nPoints = 100;

                var dx = Math.abs(BBOXCorners[2] - BBOXCorners[0]);
                var dy = Math.abs(BBOXCorners[3] - BBOXCorners[1]);
                var len = Math.sqrt((dx * dy) / nPoints);
                var xStep = dx / Math.round((dx / len) - 1);
                var yStep = dy / Math.round((dy / len) - 1);
                var width = dx + xStep/2;
                var height = dy + yStep/2;
                var x0 = (BBOXCorners[0] < BBOXCorners[2]) ? BBOXCorners[0] : BBOXCorners[2];
                var y0 = (BBOXCorners[1] < BBOXCorners[3]) ? BBOXCorners[1] : BBOXCorners[3];
                var x,y,delim = '';
                var dataRequestParameter = '&latlons=';

                for (x = 0; x < width; x += xStep) {
                    for (y = 0; y < height; y += yStep) {
                         dataRequestParameter += (delim + (y0 + y).toPrecision(5) + ',' + (x0 + x).toPrecision(5));
                         delim = ',';
                    }
                 }

                return dataRequestParameter;
            }
            function extractBBOXFilter(requestParameter, queryFilters) : String {
                var propFilter : Filter = _.find(queryFilters, { filterClass: 'BBOXFilter' });

                if (propFilter) {
                    queryFilters.splice(queryFilters.indexOf(propFilter), 1);

                    if (requestParameter.propertyName == 'bbox') {
                        return requestParameter.parameterName + propFilter.parameters.coords;
                    }
                    else {
                        return pointsWithinBBOX(propFilter.parameters.coords);
                    }
                }
            }

            // data backend request parameters extracted from filters
            //
            var BBOXQueryType = collection.enumerable ? 'bbox' : 'points';

            const dataRequestParameterMap = new Map([
                [ 'parametername', new RequiredDataRequestParameter('&param=lat,lon,utctime as Time', 'parametername', extractPropertyFilter) ]
               ,[ 'time', new RequiredDataRequestParameter('&time=', 'time', extractTimeFilter) ]
               ,[ 'bbox', new RequiredGroupDataRequestParameter('location', '&bbox=', BBOXQueryType, extractBBOXFilter) ]
               ,[ 'place', new RequiredGroupDataRequestParameter('location', '&place=', 'place', extractPropertyFilter) ]
            ]);

            var parameterGroups = new Set();
            var dataRequestParameters = '';
            var nParams : number = 0;

            for (const [parameterName, requestParameter] of dataRequestParameterMap.entries()) {
                if (requestParameter instanceof RequiredGroupDataRequestParameter) {
                    parameterGroups.add(requestParameter.groupName);
                }
            }

            for (const [parameterName, requestParameter] of dataRequestParameterMap.entries()) {
                var dataRequestParameter = requestParameter.filterFunction(requestParameter, queryFilters, paramMap);

                if (!dataRequestParameter) {
                    if (requestParameter instanceof RequiredDataRequestParameter) {
                        throw new Error('Parameter \'' + requestParameter.propertyName + '\' is required');
                    }
                }
                else {
                    if (requestParameter instanceof RequiredGroupDataRequestParameter) {
                        parameterGroups.delete(requestParameter.groupName);
                    }

                    dataRequestParameters += dataRequestParameter;

                    if (parameterName == 'parametername') {
                        nParams = (((dataRequestParameter.match(/,/g) || []).length) + 1);
                        nParams += ((dataRequestParameter.match(/%2C/g) || []).length) - 3; // -3; lat,lon,utctime
                    }
                }
            }

            if (parameterGroups.size > 0) {
                if (collection.enumerable) {
                    // Using default location(s) for enumerable data
                    //
                    dataRequestParameters += collection.defaultLocation;
                }
                else {
                    throw new Error('Parameter of parameter group \'' + parameterGroups.entries().next().value[0] + '\' is required');
                }
            }

            // Adjust max number of rows and nextToken to the start of first row for timeseries

            nextTokenRow.row = Math.floor(nextTokenRow.nextToken / nParams);
            nextTokenRow.curToken = nextTokenRow.row * nParams;
            var n = nextTokenRow.limit + (nextTokenRow.nextToken - nextTokenRow.curToken);
            nextTokenRow.limit = Math.floor(n / nParams) + (((n % nParams) > 0) ? 1 : 0);
            console.debug('nParams',nParams,'next',nextTokenRow.nextToken,'row',nextTokenRow.row,'cur',nextTokenRow.curToken,'lim',nextTokenRow.limit);

            return dataRequestParameters;
        }

        function dataRequestUrl(collection : GeoJSONCollection, dataRequestParameters : String, nextTokenRow) : String {
            var request = collection.server + '/timeseries?producer=' + collection.producer + dataRequestParameters +
                          '&startrow=' + String(nextTokenRow.row) + '&maxresults=' + String(nextTokenRow.limit) + '&format=json';
            console.debug(request);

            return request;
        }

        function dataQuery(collection : GeoJSONCollection, nextTokenRow, limit : Number, ret) {
            class Geometry implements GeoJSONGeometry {
                type : string;
                coordinates : Number[];

                constructor() {
                    this.type = 'Point';
                    this.coordinates = [ ];
                }
            }

            const http = require('http');
            var paramMap = new Map();
            var requestParameters = extractDataQueryParameters(collection, ret.remainingFilter, nextTokenRow, paramMap);
            var buf = '';

            http.get(dataRequestUrl(collection, requestParameters, nextTokenRow), (response) => {
                var outputCount = 0;

                response.on('data', (chunk) => {
                    buf += chunk;
                }).on("end", () => {
                    var rows;
                    var idx = 0;

                    try {
                        rows = ((buf.length > 0) ? JSON.parse(buf) : Array());
                        console.debug('Rows',rows.length);
                    }
                    catch (err) {
                        console.error('Response parsing error: ' + err.message);

                        ret.push(err);
                        ret.push(null);
                        return;
                    }

                    function nextRow() {
                        if ((idx < rows.length) && (outputCount < limit)) {
                            let item = new Item();
                            item.feature = new Feature();
                            item.feature.properties = { };
                            item.feature.geometry = new Geometry();
                            var row = rows[idx++];
                            var data = { };
                            var N = 1;
                            nextTokenRow.row++;

                            Object.keys(row).forEach((col) => {
                                if (col == 'lat' || col == 'lon') {
                                    item.feature.geometry.coordinates[col == 'lon' ? 0 : 1] = row[col];
                                }
                                else if (col == 'Time') {
                                    item.feature.properties[col] = row[col];
                                }
                                else {
                                    data[col] = row[col];
                                }
                            });

                            Object.keys(data).forEach((param) => {
//                              Object.keys(param).forEach((value) => {
                                if ((nextTokenRow.curToken++ >= nextTokenRow.nextToken) && (outputCount < limit)) {
                                    item.feature.properties['gml_id'] = 'BsWfsElement.1.' + String(nextTokenRow.row) + '.' + String(N);
                                    item.feature.properties['ParameterName'] = paramMap[param];
                                    item.feature.properties['ParameterValue'] = data[param];
//                                  item.feature.properties['ParameterValue'] = data[value];

                                    item.nextToken = String(++nextTokenRow.nextToken);

                                    if (ret.push(item)) {
                                        outputCount++;
                                    }
                                    else
                                        console.debug('Filt',nextTokenRow.nextToken,param,data[param]);
                                }

                                N++;
//                              }
                            });

                            setTimeout(nextRow, 5);
                        }
                        else {
                            ret.push(null);
                        }
                    }

                    setTimeout(nextRow, 5);
                }).on("error", (err) => {
                    console.error('Data query error: ' + err.message);

                    ret.push(err);
                    ret.push(null);
                })
             });
        }

        var nextTokenRow = { nextToken: nextToken, curToken: nextToken, row: 0, limit: query.limit };

        dataQuery(this, nextTokenRow, query.limit, ret);

        return ret;
    }

    getFeatureById(id : string) : Promise<Feature> {
        var ret = new Promise((resolve) => {
            setTimeout(() => {
                var feature = _.find(this.data.features, f => f.properties.gml_id === id);
                resolve(feature);
            }, 5);
        });

        return ret;
    }
};

export {SofpSmartmetBackend};
