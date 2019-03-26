import {Backend, Collection, Link, Query, FeatureStream, Feature, Item, Filter, Property} from 'sofp-lib';

import * as _ from 'lodash';

let SofpSmartmetBackend = new Backend('SofpSmartmetBackend');

// Load configuration file

const fs = require('fs');
var readStream = fs.createReadStream('backends/smartmet-sofp-backend/cnf/smartmet.json');
var buf = '';

readStream.on('data', (chunk) => {
    buf += chunk;
}).on("end", () => {
    try {
        var conf = JSON.parse(buf);

        // Server url

        if ((!_.has(conf, 'server')) || (!_.isString(conf.server)) || (conf.server == '')) {
            throw new Error('\'server\' must be an nonempty string (host:port)');
        }

        // Innumerable (forecast) data collections

        if (_.has(conf, 'innumerabledatacollections')) {
            if (!_.isArray(conf.innumerabledatacollections)) {
                throw new Error('\'innumerabledatacollections\' must be an array of objects');
            }

            _.forEach(conf.innumerabledatacollections, (collection) => {
                if (!_.isObject(collection)) {
                    throw new Error('\'innumerabledatacollections\' must be an array of objects');
                }

                if ((!_.isString(collection.name)) || (collection.name == '')) {
                    throw new Error('innumerabledatacollections: \'name\' must be a nonempty string');
                }

                if (_.has(collection,'title')) {
                    if ((!_.isString(collection.title)) || (collection.title == '')) {
                        throw new Error('innumerabledatacollections: \'title\' must be a nonempty string');
                    }
                }
                else {
                    collection.title = collection.name;
                }

                if (_.has(collection,'description')) {
                    if ((!_.isString(collection.description)) || (collection.description == '')) {
                        throw new Error('innumerabledatacollections: \'description\' must be a nonempty string');
                    }
                }
                else {
                    collection.description = collection.name + ' data by FMI';
                }

                if ((!_.isString(collection.defaultlocation)) || (collection.defaultlocation == '')) {
                    throw new Error('innumerabledatacollections: \'defaultlocation\' must be a nonempty string (locationparam=value)');
                }

                if (_.has(collection,'defaulttime')) {
                    if ((!_.isString(collection.defaulttime)) || (collection.defaulttime == '')) {
                        throw new Error('innumerabledatacollections: \'defaulttime\' must be a nonempty string (timeparam=value)');
                    }
                }
                else {
                   collection.defaulttime = 'starttime=data';
                }

                if ((!_.isString(collection.defaultparameters)) || (collection.defaultparameters == '')) {
                    throw new Error('innumerabledatacollections: \'defaultparameters\' must be a nonempty string (param1,param2,..)');
                }

                SofpSmartmetBackend.collections.push(new GeoJSONCollection(collection.name,
                                                                           collection.title,
                                                                           collection.description +
                                                                           '. Default parameter set contains following parameters: ' +
                                                                           collection.defaultparameters,
                                                                           conf.server,
                                                                           collection.name,
                                                                           '',
                                                                           collection.defaultlocation,
                                                                           collection.defaulttime,
                                                                           collection.defaultparameters,
                                                                           false,
                                                                           false));

                SofpSmartmetBackend.collections.push(new GeoJSONCollection(collection.name + '_timeserie',
                                                                           collection.title + ' time serie',
                                                                           collection.description + ' in time serie format' +
                                                                           '. Default parameter set contains following parameters: ' +
                                                                           collection.defaultparameters,
                                                                           conf.server,
                                                                           collection.name,
                                                                           '',
                                                                           collection.defaultlocation,
                                                                           collection.defaulttime,
                                                                           collection.defaultparameters,
                                                                           false,
                                                                           true));
            });
        }

        // Enumerable (observation) data collections

        if (_.has(conf, 'enumerabledatacollections')) {
            if (!_.isArray(conf.enumerabledatacollections)) {
                throw new Error('\'enumerabledatacollections\' must be an array of objects');
            }

            _.forEach(conf.enumerabledatacollections, (collections) => {
                if (!_.isArray(collections.collections)) {
                    throw new Error('enumerabledatacollections: \'collections\' must be an array of objects');
                }

                var timeSteps = [ '' ];
                var checkDefaultParams = true;

                if (_.has(collections,'timesteps')) {
                    if (!_.isArray(collections.timesteps)) {
                        throw new Error('enumerabledatacollections: \'timesteps\' must be an array of strings');
                    }
                    else {
                        timeSteps = collections.timesteps;
                    }
                }

                _.forEach(collections.collections, (collection) => {
                    if (!_.isObject(collection)) {
                        throw new Error('enumerabledatacollections: collection must be an object');
                    }

                    _.forEach(timeSteps, (timeStep) => {
                        var timeStepSuffix = '';
                        var timeStepName = '';

                        if (!_.isString(timeStep)) {
                            throw new Error('enumerabledatacollections: timestep must be a string');
                        }
                        else if (timeStep != '') {
                            timeStepSuffix =  '_' + timeStep;
                            timeStepName = ' ' + timeStep;
                            timeStep = '&timestep=' + timeStep;
                        }

                        if ((!_.isString(collection.name)) || (collection.name == '')) {
                            throw new Error('enumerabledatacollections: \'name\' must be a nonempty string');
                        }

                        if (_.has(collection,'title')) {
                            if ((!_.isString(collection.title)) || (collection.title == '')) {
                                throw new Error('enumerabledatacollections: \'title\' must be a nonempty string');
                            }
                        }
                        else {
                            collection.title = collection.name;
                        }

                        if (_.has(collection,'description')) {
                            if ((!_.isString(collection.description)) || (collection.description == '')){
                                throw new Error('enumerabledatacollections: \'description\' must be a nonempty string');
                            }
                        }
                        else {
                            collection.description = collection.name + timeStepName + ' data by FMI.';
                        }

                        if (_.has(collection,'defaultlocation')) {
                            if ((!_.isString(collection.defaultlocation)) || (collection.defaultlocation == '')) {
                                throw new Error('enumerabledatacollections: \'defaultlocation\' must be a nonempty string (locationparam=value)');
                            }
                        }
                        else {
                            collection.defaultlocation = 'keyword=ajax_fi_all';
                        }

                        if (_.has(collection,'defaulttime')) {
                            if ((!_.isString(collection.defaulttime)) || (collection.defaulttime == '')) {
                                throw new Error('enumerabledatacollections: \'defaulttime\' must be a nonempty string (timeparam=value)');
                            }
                        }
                        else {
                           collection.defaulttime = 'starttime=-24h';
                        }

                        if (checkDefaultParams) {
                            if ((!_.isString(collection.defaultparameters)) || (collection.defaultparameters == '')) {
                                throw new Error('enumerabledatacollections: \'defaultparameters\' must be a nonempty string (param1,param2,..)');
                            }

                            checkDefaultParams = false;
                        } 

                        SofpSmartmetBackend.collections.push(new GeoJSONCollection(collection.name + timeStepSuffix,
                                                                                   collection.title + timeStepName,
                                                                                   collection.description +
                                                                                   '. Default parameter set contains following parameters: ' +
                                                                                   collection.defaultparameters,
                                                                                   conf.server,
                                                                                   collection.name,
                                                                                   timeStep,
                                                                                   collection.defaultlocation,
                                                                                   collection.defaulttime,
                                                                                   collection.defaultparameters,
                                                                                   true,
                                                                                   false));

                        SofpSmartmetBackend.collections.push(new GeoJSONCollection(collection.name + timeStepSuffix + '_timeserie',
                                                                                   collection.title + timeStepName + ' time serie',
                                                                                   collection.description  + ' in time serie format' +
                                                                                   '. Default parameter set contains following parameters: ' +
                                                                                   collection.defaultparameters,
                                                                                   conf.server,
                                                                                   collection.name,
                                                                                   timeStep,
                                                                                   collection.defaultlocation,
                                                                                   collection.defaulttime,
                                                                                   collection.defaultparameters,
                                                                                   true,
                                                                                   true));
                    });
                });
            });
        }

        if (SofpSmartmetBackend.collections.length == 0) {
            throw new Error('No collections');
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
    properties : { id: String };
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
    defaultValue : String;
};

class GeoJSONCollection implements Collection {
    name : string;
    title : string;
    description : string;
    links : Link[] = [];

    server : string;
    producer : string;
    timestep : string;
    enumerable : boolean;
    timeserieoutput : boolean;
    defaultLocation : string;
    defaultTime : string;
    defaultParameters : string;
    data : GeoJSONFeatureCollection;

    properties : Property [] = [{
        name: 'observationType',
        type: 'string',
        description: 'Feature type'
    },{
        name: 'id',
        type: 'string',
        description: 'Feature id'
    },{
        name: 'time',
        type: 'string',
        description: 'Data target time instant or range'
    },{
        name: 'phenomenonTime',
        type: 'string',
        description: 'Data time instant'
    },{
        name: 'observedPropertyName',
        type: 'string',
        description: 'Name of parameter'
    },{
        name: 'result',
        type: 'number',
        description: 'Value of parameter'
    },{
        name: 'resultTime',
        type: 'string',
        description: 'Result time instant'
    },{
        name: 'place',
        type: 'string',
        description: 'Data target location name(s)'
    },{
        name: 'latlon',
        type: 'string',
        description: 'Data target latlon coordinate(s)'
    },{
        name: 'lonlat',
        type: 'string',
        description: 'Data target lonlat coordinate(s)'
    }];

    constructor(name, title, description, server, producer, timestep, defaultLocation, defaultTime, defaultParameters, enumerable, timeSerieOutput) {
        this.name = name;
        this.title = title;
        this.description = description;
        this.server = server;
        this.producer = producer;
        this.timestep = timestep;
        this.defaultLocation = defaultLocation;
        this.defaultTime = defaultTime;
        this.defaultParameters = defaultParameters;
        this.enumerable = enumerable;
        this.timeserieoutput = timeSerieOutput
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
            defaultValue : String;

            constructor(parameterName : String, propertyName : String, filterFunction : Function, defaultValue : String) {
                this.parameterName = parameterName;
                this.propertyName = propertyName;
                this.filterFunction = filterFunction;
                this.required = true;
                this.defaultValue = defaultValue;
            }
        }
        class RequiredGroupDataRequestParameter implements DataRequestParameter {
            parameterName : String;
            propertyName : String;
            groupName : String;
            filterFunction : Function;
            required : Boolean;
            defaultValue : String;

            constructor(groupName : String, parameterName : String, propertyName : String, filterFunction : Function, defaultValue : String) {
                this.parameterName = parameterName;
                this.propertyName = propertyName;
                this.groupName = groupName;
                this.filterFunction = filterFunction;
                this.required = true;
                this.defaultValue = defaultValue;
            }
        }
        class OptionalDataRequestParameter implements DataRequestParameter {
            parameterName : String;
            propertyName : String;
            groupName : String;
            filterFunction : Function;
            required : Boolean;
            defaultValue : String;

            constructor(parameterName : String, propertyName : String, filterFunction : Function, defaultValue: String) {
                this.parameterName = parameterName;
                this.propertyName = propertyName;
                this.filterFunction = filterFunction;
                this.required = false;
                this.defaultValue = defaultValue;
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
                    if (requestParameter.propertyName == 'observedpropertyname') {
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
                else if (_.isString(requestParameter.defaultValue) && (requestParameter.defaultValue != '')) {
                    _.forEach(decodeURIComponent(requestParameter.defaultValue).split(','), (param) => {
                        var alias = param +'_p' + String(Object.keys(paramMap).length + 1);
                        paramMap[alias] = param;
                        filter += (((nElem++ == 0) ? "" : ",") + encodeURIComponent(param) + ' as ' + alias);
                    });

                    return filter;
                }
            }
            function extractTimeFilter(requestParameter, queryFilters) : String {
                var propFilter : Filter = _.find(queryFilters, { filterClass: 'TimeFilter' });

                if (propFilter) {
                    queryFilters.splice(queryFilters.indexOf(propFilter), 1);
 
                    return "&starttime=" + propFilter.parameters.momentStart.utc().format() +
                           "&endtime=" + propFilter.parameters.momentEnd.utc().format();
                }
                else if (_.isString(requestParameter.defaultValue) && (requestParameter.defaultValue != '')) {
                    return '&' + encodeURIComponent(requestParameter.defaultValue);
                }
            }
            function pointsWithinBBOX(BBOXCorners : number[]) : String {
                // Return evenly spaced points within the bbox
                //
                if (BBOXCorners.length != 4) {
                   throw new Error('Invalid bbox: ' + _.map(BBOXCorners).join(','));
                }

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

                if (isNaN(width) || isNaN(height)) {
                    throw new Error('Invalid bbox: ' + _.map(BBOXCorners).join(','));
                }

                for (x = 0; x < width; x += xStep) {
                    for (y = 0; y < height; y += yStep) {
                         dataRequestParameter += (delim + (y0 + y).toFixed(5) + ',' + (x0 + x).toFixed(5));
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
                else if (requestParameter.defaultValue && (requestParameter.defaultValue.substring(0,5) == 'bbox=')) {
                    if (requestParameter.propertyName == 'bbox') {
                        return requestParameter.parameterName + requestParameter.defaultValue.substring(5);
                    }
                    else {
                        var numStrArr = requestParameter.defaultValue.substring(5).split(',');
                        var BBOX = [];

                        for (var i = 0, len = numStrArr.length; (i < len); i++) {
                            BBOX.push(Number(numStrArr[i]));
                        }

                        return pointsWithinBBOX(BBOX);
                    }
                }
            }
            function extractCoordinateFilter(requestParameter, queryFilters) : String {
                var propFilter : Filter = _.find(queryFilters, { filterClass: 'PropertyFilter' });

                if (propFilter && (_.keys(propFilter.parameters.properties).indexOf(requestParameter.propertyName) >= 0)) {
                    var filter = requestParameter.parameterName;
                    var nElem = 0;
                    var nextCoordIsLat = (requestParameter.propertyName == 'latlon');
                    var coords = propFilter.parameters.properties[requestParameter.propertyName].split(',');

                    if ((coords.length < 2) || ((coords.length % 2) != 0)) {
                        throw new Error('Invalid number of ' + requestParameter.propertyName + ' coordinate values: ' +
                                        propFilter.parameters.properties[requestParameter.propertyName]);
                    }

                    _.forEach(coords, (coord) => {
                        var coordOk = false;

                        if (!isNaN(coord)) {
                            var value = Number(coord);
                            var minValue = (nextCoordIsLat ? -90 : -180);
                            var maxValue = (nextCoordIsLat ? 90 : 180);

                            coordOk = ((value >= minValue) && (value <= maxValue))
                        }

                        if (!coordOk) {
                            throw new Error('Invalid ' + requestParameter.propertyName + ' coordinate value: ' + coord);
                        }

                        filter += (((nElem++ == 0) ? "" : ",") + coord);

                        nextCoordIsLat = (!nextCoordIsLat);
                    });

                    delete propFilter.parameters.properties[requestParameter.propertyName];

                    return filter;
                }
            }

            // data backend request parameters extracted from filters
            //
            var BBOXQueryType = collection.enumerable ? 'bbox' : 'points';

            const dataRequestParameterMap = new Map([
                [
                 'observedpropertyname',
                 new OptionalDataRequestParameter(
                                                  '&param=lat,lon,utctime as phenomenonTime,origintime as resultTime',
                                                  'observedpropertyname',
                                                  extractPropertyFilter, collection.defaultParameters
                                                 )
                ]
               ,[ 'time', new OptionalDataRequestParameter('&time=', 'time', extractTimeFilter, collection.defaultTime) ]
               ,[ 'place', new RequiredGroupDataRequestParameter('location', '&places=', 'place', extractPropertyFilter, null) ]
               ,[ 'latlon', new RequiredGroupDataRequestParameter('location', '&latlons=', 'latlon', extractCoordinateFilter, null) ]
               ,[ 'lonlat', new RequiredGroupDataRequestParameter('location', '&lonlats=', 'lonlat', extractCoordinateFilter, null) ]
               ,[ 'bbox', new RequiredGroupDataRequestParameter('location', '&bbox=', BBOXQueryType, extractBBOXFilter, collection.defaultLocation) ]
            ]);

            var parameterGroups = new Set();
            var defaultLocation = collection.defaultLocation;
            var dataRequestParameters = '';
            var nParams : number = 0;

            for (const [parameterName, requestParameter] of dataRequestParameterMap.entries()) {
                if (requestParameter instanceof RequiredGroupDataRequestParameter) {
                    parameterGroups.add(requestParameter.groupName);
                }
            }

            for (const [parameterName, requestParameter] of dataRequestParameterMap.entries()) {
                if ((requestParameter instanceof RequiredGroupDataRequestParameter) && requestParameter.defaultValue) {
                    // Clear (if place or coordinate was given) or (re)set default location when parsing bbox
                    //
                    requestParameter.defaultValue = defaultLocation;
                }

                var dataRequestParameter = requestParameter.filterFunction(requestParameter, queryFilters, paramMap);

                if (!dataRequestParameter) {
                    if (requestParameter instanceof OptionalDataRequestParameter) {
                        // Optional parameters must have nonempty default value; should not end up here
                        //
                        throw new Error('Parameter \'' + requestParameter.propertyName + '\' is required');
                    }
                }
                else {
                    if (requestParameter instanceof RequiredGroupDataRequestParameter) {
                        parameterGroups.delete(requestParameter.groupName);
                        defaultLocation = null;
                    }

                    dataRequestParameters += dataRequestParameter;

                    if (parameterName == 'observedpropertyname') {
                        nParams = (((dataRequestParameter.match(/,/g) || []).length) + 1);
                        nParams += ((dataRequestParameter.match(/%2C/g) || []).length) - 4; // -4; lat,lon,utctime,origintime
                    }
                }
            }

            if (parameterGroups.size > 0) {
                // Default location was not bbox or place; use as is
                //
                dataRequestParameters += ('&' + collection.defaultLocation);
            }

            // Adjust max number of rows and nextToken to the start of first row for timeseries
            //
            // Note: currently data must be fetched starting from 1'st row, because number of locations
            // (i.e. number of values nParams * nLocations) per row is unknown
            //
            // nextTokenRow.row = Math.floor(nextTokenRow.nextToken / nParams);

            nextTokenRow.row = 0;
            nextTokenRow.curToken = nextTokenRow.row * nParams;

            if (collection.timeserieoutput) {
                // Note: currently all data must be fetched because number of timesteps is unknown
                //
                nextTokenRow.limit = 0;
            }
            else {
                var n = nextTokenRow.limit + (nextTokenRow.nextToken - nextTokenRow.curToken);
                nextTokenRow.limit = Math.floor(n / nParams) + (((n % nParams) > 0) ? 1 : 0);
            }

            console.debug('nParams',nParams,'next',nextTokenRow.nextToken,'row',nextTokenRow.row,'cur',nextTokenRow.curToken,'lim',nextTokenRow.limit);

            return dataRequestParameters;
        }

        function dataRequestUrl(collection : GeoJSONCollection, dataRequestParameters : String, nextTokenRow) : String {
            var request = collection.server + '/timeseries?producer=' + collection.producer + dataRequestParameters +
                          '&startrow=' + String(nextTokenRow.row) + '&maxresults=' + String(nextTokenRow.limit) +
                          '&format=json&missingtext=null&tz=UTC' + collection.timestep;
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
                            item.feature.type = 'Feature';
                            item.feature.properties = { };
                            item.feature.properties['observationType'] = 'MeasureObservation';
                            item.feature.geometry = new Geometry();
                            var row = rows[idx++];
                            var data = { };
                            var N = 1;
                            nextTokenRow.row++;

                            Object.keys(row).forEach((col) => {
                                if ((col == 'phenomenonTime') || (col == 'resultTime'))  {
                                    // Use phenomenon time as result time for observations
                                    //
                                    var c = (((col == 'resultTime') && collection.enumerable) ? 'phenomenonTime' : col);
                                    item.feature.properties[col] = row[c];
                                }
                                else if ((col != 'lat') && (col != 'lon')) {
                                    data[col] = row[col];
                                }
                            });

                            Object.keys(data).forEach((param) => {
                                // Without 'timestep' timeseries may return less values than coordinates when there are missing (N/A)
                                // values (e.g. minute resolution observations available for only some of the stations).
                                //
                                var arrayValue = _.isArray(data[param]);
                                var arrayCoord = _.isArray(row['lon']);
                                var numValues = arrayValue ? data[param].length : 1;
                                var numCoords = arrayCoord ? row['lon'].length : 1;
                                var valIdx = 0;

                                if (numValues != numCoords) {
                                    console.debug(paramMap[param] + ' value/coordinate count mismatch ' +
                                                  item.feature.properties['phenomenonTime'],numValues,numCoords);
                                    numValues = (numValues > numCoords ? numCoords : numValues);
                                }

                                while ((valIdx < numValues) && (outputCount < limit)) {
                                    if (nextTokenRow.curToken++ >= nextTokenRow.nextToken) {
                                        item.feature.properties['id'] = 'BsWfsElement.1.' + String(nextTokenRow.row) + '.' + String(N);
                                        item.feature.properties['observedPropertyName'] = paramMap[param];
                                        item.feature.properties['result'] = arrayValue ? data[param][valIdx] : data[param];
                                        item.feature.geometry.coordinates[0] = arrayCoord ? row['lon'][valIdx] : row['lon'];
                                        item.feature.geometry.coordinates[1] = arrayCoord ? row['lat'][valIdx] : row['lat'];

                                        item.nextToken = String(++nextTokenRow.nextToken);

                                        if (ret.push(item)) {
                                            outputCount++;
                                        }
                                        else
                                            console.debug('Filter',nextTokenRow.nextToken,param,arrayValue ? data[param][valIdx] : data[param]);
                                    }

                                    valIdx++;
                                    N++;
                                }
                            });

                            setTimeout(nextRow, 5);
                        }
                        else {
                            ret.push(null);
                        }
                    }

                    var items = { }
                    var item = null;
                    var nFeatures = 0;

                    function nextTimeSerieRow() {
                        if ((idx < rows.length) && (outputCount < limit)) {
                            var row = rows[idx++];
                            var data = { };
                            var timeColumns = { }
                            nextTokenRow.row++;

                            Object.keys(row).forEach((col) => {
                                if ((col == 'phenomenonTime') || (col == 'resultTime'))  {
                                    // Use phenomenon time as result time for observations
                                    //
                                    var c = (((col == 'resultTime') && collection.enumerable) ? 'phenomenonTime' : col);
                                    timeColumns[col] = row[c];
                                }
                                else if ((col != 'lat') && (col != 'lon')) {
                                    data[col] = row[col];
                                }
                            });

                            Object.keys(data).forEach((param) => {
                                // Without 'timestep' timeseries may return less values than coordinates when there are missing (N/A)
                                // values (e.g. minute resolution observations available for only some of the stations).
                                //
                                var arrayValue = _.isArray(data[param]);
                                var arrayCoord = _.isArray(row['lon']);
                                var numValues = arrayValue ? data[param].length : 1;
                                var numCoords = arrayCoord ? row['lon'].length : 1;
                                var valIdx = 0;

                                if (numValues != numCoords) {
                                    console.debug(paramMap[param] + ' value/coordinate count mismatch ' +
                                                  timeColumns['phenomenonTime'],numValues,numCoords);
                                    numValues = (numValues > numCoords ? numCoords : numValues);
                                }

                                while ((valIdx < numValues) && (outputCount < limit)) {
                                    item = items[param];

                                    if (item) {
                                        if (
                                            ((arrayCoord ? row['lon'][valIdx] : row['lon']) != item.feature.geometry.coordinates[0]) ||
                                            ((arrayCoord ? row['lat'][valIdx] : row['lat']) != item.feature.geometry.coordinates[1])
                                           ) {
                                            if (nextTokenRow.curToken++ >= nextTokenRow.nextToken) {
                                                item.nextToken = String(++nextTokenRow.nextToken);

                                                if (ret.push(item)) {
                                                    outputCount++;
                                                }
                                            }

                                            item = null;
                                            nFeatures++;
                                         }
                                    }
                                    else {
                                        nFeatures++;
                                    }

                                    if (!item) {
                                        item = new Item();
                                        item.feature = new Feature();
                                        item.feature.type = 'Feature';
                                        item.feature.properties = { };
                                        item.feature.properties['observationType'] = 'MeasureTimeseriesObservation';
                                        item.feature.properties.timestep = [ ];
                                        item.feature.geometry = new Geometry();

                                        item.feature.properties['id'] = 'BsWfsElement.1.' + String(nFeatures) + '.1';
                                        item.feature.properties['observedPropertyName'] = paramMap[param];
                                        item.feature.properties['result'] = [ ];
                                        item.feature.geometry.coordinates[0] = arrayCoord ? row['lon'][valIdx] : row['lon'];
                                        item.feature.geometry.coordinates[1] = arrayCoord ? row['lat'][valIdx] : row['lat'];
                                        items[param] = item;
                                    }

                                    var idx = item.feature.properties['result'].length;

                                    item.feature.properties['result'][idx] = arrayValue ? data[param][valIdx] : data[param];
                                    item.feature.properties['timestep'][idx] = timeColumns['phenomenonTime'];

                                    valIdx++;
                                }
                            });

                            setTimeout(nextTimeSerieRow, 5);
                        }
                        else {
                            if ((outputCount < limit) && item) {
                                if (nextTokenRow.curToken++ >= nextTokenRow.nextToken) {
                                    item.nextToken = String(++nextTokenRow.nextToken);
                                    ret.push(item);
                                }
                            }

                            ret.push(null);
                        }
                    }

                    if (collection.timeserieoutput) {
                        setTimeout(nextTimeSerieRow, 5);
                    }
                    else {
                        setTimeout(nextRow, 5);
                    }
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
                var feature = (_.isObject(this.data) ? _.find(this.data.features, f => f.properties.id === id) : null);
                resolve(feature);
            }, 5);
        });

        return ret;
    }
};

export {SofpSmartmetBackend};
