import {Backend, Collection, Link, Query, FeatureStream, Feature, Item, Filter, PropertyType, Property, QueryParameter} from 'sofp-lib';

import * as _ from 'lodash';

import {immerable, produce} from 'immer';

let SofpSmartmetBackend = new Backend('SofpSmartmetBackend');

class dataFeature { [ immerable] = true; id? : string; type = 'Feature'; properties = { }; geometry : any; }
class dataItem {
  feature : Feature;
  nextToken : string;

  constructor(feature : Feature, nextToken : number)
  {
    this.feature = feature;
    this.nextToken = String(nextToken);
  }
}

// Load configuration file

interface IFeatureId {
    parameter : string,
    producer : string,
    level_type : string,
    level : string,
    forecast_type : string,
    forecast_number : string,
    generation : string,
    area : string,
    time : string,
    area_interpolation_method : string,
    time_interpolation_method : string,
    level_interpolation_method : string,
    time0? : string
    timeN? : string
};

type FeatureIdType = IFeatureId;

function isFeatureId(id : FeatureIdType): id is IFeatureId {
    if ((id as FeatureIdType).parameter) {
        return true;
    }

    return false;
}

function idToString (featureId : IFeatureId) {
    return featureId.parameter + ':' + featureId.producer + ':' + featureId.level_type + ':' + featureId.level + ':' +
           featureId.forecast_type + ':' + featureId.forecast_number + ':' +
           featureId.generation + ':' + featureId.area + ':' + featureId.time + ':' +
           featureId.area_interpolation_method + ':' + featureId.time_interpolation_method + ':' + featureId.level_interpolation_method;
}

interface ICollectionConfig {
    id : string;
    name : string;
    title : string;
    description : string;
    producer : string;
    neareststations : string;
    timeserierowlimit : number;
    defaultlocation : string;
    defaulttime : string;
    defaultparameters : string;
    links : Link[];
//  extent : Extent;
}

type CollectionConfigType = ICollectionConfig;

const fs = require('fs');
let configStream = fs.createReadStream('backends/smartmet-sofp-backend/cnf/smartmet.json');
let configBuf = '';

configStream.on('data', (chunk) => {
    configBuf += chunk;
}).on("end", () => {
    try {
        let conf = JSON.parse(configBuf);

        // Server url

        if ((!_.has(conf, 'server')) || (!_.isString(conf.server)) || (conf.server == '')) {
            throw new Error('\'server\' must be an nonempty string (host:port)');
        }

        // Feature id default field values. Parameter, producer, generation, area and time are set from request/data.
        //
        // [param]:[producer]:leveltype:level:forecasttype:forecastnumber:generation:area:time:areainterp:timeinterp:levelinterp

        if ((!_.has(conf, 'featureid')) || (!isFeatureId(conf.featureid))) {
            throw new Error('\'featureid\' must be a FeatureId object');
        }

        // Innumerable (forecast) data collections

        if (_.has(conf, 'innumerabledatacollections')) {
            if (!_.isArray(conf.innumerabledatacollections)) {
                throw new Error('\'innumerabledatacollections\' must be an array of objects');
            }

            _.forEach(conf.innumerabledatacollections, (collection : CollectionConfigType) => {
                if (!_.isObject(collection)) {
                    throw new Error('\'innumerabledatacollections\' must be an array of objects');
                }

                if ((!_.isString(collection.name)) || (collection.name == '')) {
                    throw new Error('innumerabledatacollections: \'name\' must be a nonempty string');
                }

                if (_.has(collection,'id')) {
                    if ((!_.isString(collection.id)) || (collection.id == '')) {
                        throw new Error('innumerabledatacollections: \'id\' must be a nonempty string');
                    }
                }
                else {
                    collection.id = collection.name;
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

                if ((!_.isString(collection.producer)) || (collection.producer == '')) {
                    throw new Error('innumerabledatacollections: \'producer\' must be a nonempty string');
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

                let theCollection : GeoJSONCollection = {} as any;

                theCollection = new GeoJSONCollection(collection.id + ':' +
                                                      (SofpSmartmetBackend.collections.length+1),
                                                      collection.title,
                                                      collection.description +
                                                      '. Default parameter set contains following parameters: ' +
                                                      collection.defaultparameters,
                                                      conf.server,
                                                      collection.producer,
                                                      null,
                                                      0,
                                                      '',
                                                      collection.defaultlocation,
                                                      collection.defaulttime,
                                                      collection.defaultparameters,
                                                      conf.featureid,
                                                      false,
                                                      false);

                if (_.has(collection,'links')) {
                    collection.links.forEach((l, i) => {
                        theCollection.links.push(l);
                    });
                }

//              if (_.has(collection,'extent')) {
//                  let extent : Extent = {
//                      spatial : collection.extent.spatial,
//                      temporal : collection.extent.temporal
//                    };
//
//                  theCollection.extent = extent;
//              }

                SofpSmartmetBackend.collections.push(theCollection);

                theCollection = new GeoJSONCollection(collection.id + '_timeseries:' +
                                                      (SofpSmartmetBackend.collections.length+1),
                                                      collection.title + ' time series',
                                                      collection.description + ' in time series format' +
                                                      '. Default parameter set contains following parameters: ' +
                                                      collection.defaultparameters,
                                                      conf.server,
                                                      collection.producer,
                                                      null,
                                                      0,
                                                      '',
                                                      collection.defaultlocation,
                                                      collection.defaulttime,
                                                      collection.defaultparameters,
                                                      conf.featureid,
                                                      false,
                                                      true);

                if (_.has(collection,'links')) {
                    collection.links.forEach((l, i) => {
                        theCollection.links.push(l);
                    });
                }

//              if (_.has(collection,'extent')) {
//                  let extent : Extent = {
//                      spatial : collection.extent.spatial,
//                      temporal : collection.extent.temporal
//                    };
//
//                  theCollection.extent = extent;
//              }

                SofpSmartmetBackend.collections.push(theCollection);
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

                let timeSteps = [ '' ];
                let checkDefaultParams = true;

                if (_.has(collections,'timesteps')) {
                    if (!_.isArray(collections.timesteps)) {
                        throw new Error('enumerabledatacollections: \'timesteps\' must be an array of strings');
                    }
                    else {
                        timeSteps = collections.timesteps;
                    }
                }

                _.forEach(collections.collections, (collection : CollectionConfigType) => {
                    if (!_.isObject(collection)) {
                        throw new Error('enumerabledatacollections: collection must be an object');
                    }

                    _.forEach(timeSteps, (timeStep) => {
                        let timeStepSuffix = '';
                        let timeStepName = '';

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

                        if (_.has(collection,'id')) {
                            if ((!_.isString(collection.id)) || (collection.id == '')) {
                                throw new Error('enumerabledatacollections: \'id\' must be a nonempty string');
                            }
                        }
                        else {
                            collection.id = collection.name;
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

                        if ((!_.isString(collection.producer)) || (collection.producer == '')) {
                            throw new Error('enumerabledatacollections: \'producer\' must be a nonempty string');
                        }

                        if (_.has(collection,'neareststations')) {
                            if ((!_.isString(collection.neareststations)) || (collection.neareststations == '')) {
                                throw new Error('enumerabledatacollections: \'neareststations\' must be a nonempty string');
                            }
                        }

                        if (_.has(collection,'timeserierowlimit')) {
                            if (!_.isNumber(collection.timeserierowlimit)) {
                                throw new Error('enumerabledatacollections: \'timeserierowlimit\' must be a number');
                            }
                        }
                        else
                            collection.timeserierowlimit = 0;

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

                        let theCollection : GeoJSONCollection = {} as any;

                        theCollection = new GeoJSONCollection(collection.id + timeStepSuffix + ':' +
                                                              (SofpSmartmetBackend.collections.length+1),
                                                              collection.title + timeStepName,
                                                              collection.description +
                                                              '. Default parameter set contains following parameters: ' +
                                                              collection.defaultparameters,
                                                              conf.server,
                                                              collection.producer,
                                                              collection.neareststations,
                                                              0,
                                                              timeStep,
                                                              collection.defaultlocation,
                                                              collection.defaulttime,
                                                              collection.defaultparameters,
                                                              conf.featureid,
                                                              true,
                                                              false);

                        if (_.has(collection,'links')) {
                            collection.links.forEach((l, i) => {
                                theCollection.links.push(l);
                            });
                        }

//                      if (_.has(collection,'extent')) {
//                          let extent : Extent = {
//                              spatial : collection.extent.spatial,
//                              temporal : collection.extent.temporal
//                            };
//
//                          theCollection.extent = extent;
//                      }

                        SofpSmartmetBackend.collections.push(theCollection);

                        theCollection = new GeoJSONCollection(collection.id + timeStepSuffix + '_timeseries:' +
                                                              (SofpSmartmetBackend.collections.length+1),
                                                              collection.title + timeStepName + ' time series',
                                                              collection.description  + ' in time series format' +
                                                              '. Default parameter set contains following parameters: ' +
                                                              collection.defaultparameters,
                                                              conf.server,
                                                              collection.producer,
                                                              collection.neareststations,
                                                              collection.timeserierowlimit,
                                                              timeStep,
                                                              collection.defaultlocation,
                                                              collection.defaulttime,
                                                              collection.defaultparameters,
                                                              conf.featureid,
                                                              true,
                                                              true);

                        if (_.has(collection,'links')) {
                            collection.links.forEach((l, i) => {
                                theCollection.links.push(l);
                            });
                        }

//                      if (_.has(collection,'extent')) {
//                          let extent : Extent = {
//                              spatial : collection.extent.spatial,
//                              temporal : collection.extent.temporal
//                            };
//
//                          theCollection.extent = extent;
//                      }

                        SofpSmartmetBackend.collections.push(theCollection);
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
    parameterGroupIndex : number;
    propertyName : String;
    groupName : String;
    filterFunction : Function;
    required : Boolean;
    defaultValue : String;
};

class GeoJSONCollection implements Collection {
    id : string;
    title : string;
    description : string;
    links : Link[];
//  extent : Extent;

    server : string;
    producer : string;
    neareststations : string;
    timestep : string;
    enumerable : boolean;
    timeserieoutput : boolean;
    timeserierowlimit : number;
    defaultLocation : string;
    defaultTime : string;
    defaultParameters : string;
    featureId : FeatureIdType;
    data : GeoJSONFeatureCollection;

    properties : Property [] = [{
        name: 'observationType',
        type: PropertyType.string,
        description: 'Feature type'
    },{
        name: 'id',
        type: PropertyType.string,
        description: 'Feature id'
    },{
        name: 'datetime',
        type: PropertyType.string,
        description: 'Data target time instant or range'
    },{
        name: 'phenomenonTime',
        type: PropertyType.string,
        description: 'Data time instant'
    },{
        name: 'observedPropertyName',
        type: PropertyType.string,
        description: 'Name of parameter'
    },{
        name: 'result',
        type: PropertyType.number,
        description: 'Value of parameter'
    },{
        name: 'resultTime',
        type: PropertyType.string,
        description: 'Result time instant'
    }];

    additionalQueryParameters : QueryParameter [] = [{
        name : 'place',
        type : PropertyType.string,
        description : 'Filter returned features based on place name(s).',
        exampleValues : [ 'Helsinki', 'Porvoo', 'Kuopio' ]
    },{
        name: 'latlon',
        type: PropertyType.string,
        description: 'Filter returned features based on latlon coordinate(s).',
        exampleValues : [ '60.19,24.94', '60.44,25.67', '62.97,27.67' ]
    },{
        name: 'lonlat',
        type: PropertyType.string,
        description: 'Filter returned features based on lonlat coordinate(s).',
        exampleValues : [ '24.94,60.19', '25.67,60.44', '27.67,62.97' ]
    }];

    constructor(id, title, description, server, producer, neareststations, timeserierowlimit, timestep, defaultLocation, defaultTime, defaultParameters, featureId, enumerable, timeSerieOutput) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.links = [];
        this.server = server;
        this.producer = producer;
        this.neareststations = neareststations;
        this.timeserierowlimit = timeserierowlimit;
        this.timestep = timestep;
        this.defaultLocation = defaultLocation;
        this.defaultTime = defaultTime;
        this.defaultParameters = defaultParameters;
        this.featureId = featureId;
        this.enumerable = enumerable;
        this.timeserieoutput = timeSerieOutput;
    }

    executeQuery(query : Query) : FeatureStream {
        let ret = new FeatureStream();
        let additionalFilter : Filter = _.find(query.filters, { filterClass: 'AdditionalParameterFilter' });
        ret.remainingFilter = _.without(query.filters, additionalFilter);
        let nextToken = Number(query.nextToken || '0');

        class RequiredDataRequestParameter implements DataRequestParameter {
            parameterName : String;
            parameterGroupIndex : number;
            propertyName : String;
            groupName : String;
            filterFunction : Function;
            required : Boolean;
            defaultValue : String;

            constructor(parameterName : String, parameterGroupIndex : number, propertyName : String, filterFunction : Function, defaultValue : String) {
                this.parameterName = parameterName;
                this.parameterGroupIndex = parameterGroupIndex;
                this.propertyName = propertyName;
                this.filterFunction = filterFunction;
                this.required = true;
                this.defaultValue = defaultValue;
            }
        }
        class RequiredGroupDataRequestParameter implements DataRequestParameter {
            parameterName : String;
            parameterGroupIndex : number;
            propertyName : String;
            groupName : String;
            filterFunction : Function;
            required : Boolean;
            defaultValue : String;

            constructor(groupName : String, parameterName : String, parameterGroupIndex : number, propertyName : String, filterFunction : Function, defaultValue : String) {
                this.parameterName = parameterName;
                this.parameterGroupIndex = parameterGroupIndex;
                this.propertyName = propertyName;
                this.groupName = groupName;
                this.filterFunction = filterFunction;
                this.required = true;
                this.defaultValue = defaultValue;
            }
        }
        class OptionalDataRequestParameter implements DataRequestParameter {
            parameterName : String;
            parameterGroupIndex : number;
            propertyName : String;
            groupName : String;
            filterFunction : Function;
            required : Boolean;
            defaultValue : String;

            constructor(parameterName : String, propertyName : String, filterFunction : Function, defaultValue: String) {
                this.parameterName = parameterName;
                this.parameterGroupIndex = 0;
                this.propertyName = propertyName;
                this.filterFunction = filterFunction;
                this.required = false;
                this.defaultValue = defaultValue;
            }
        }
        function extractDataQueryParameters(collection : GeoJSONCollection, queryFilters : Filter[], nextTokenRow, paramMap) : String[] {
            function extractPropertyFilter(requestParameter, queryFilters : Filter[], paramMap) : String {
                let filter = requestParameter.parameterName;
                let nElem = (filter.indexOf("=") < (filter.length - 1)) ? 1 : 0;
                let propFilter : Filter = _.find(queryFilters, { filterClass: 'PropertyFilter' });

                if (propFilter && (_.keys(propFilter.parameters.properties).indexOf(requestParameter.propertyName) >= 0)) {
                    // To handle request with same data parameter multiple times, collect parameter names into a map with unique alias name
                    //
                    if (requestParameter.propertyName == 'observedpropertyname') {
                        _.forEach(decodeURIComponent(propFilter.parameters.properties[requestParameter.propertyName]).split(','), (param) => {
                            param = param.trim();
                            let alias = param +'_p' + String(Object.keys(paramMap).length + 1);
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
                        param = param.trim();
                        let alias = param +'_p' + String(Object.keys(paramMap).length + 1);
                        paramMap[alias] = param;
                        filter += (((nElem++ == 0) ? "" : ",") + encodeURIComponent(param) + ' as ' + alias);
                    });

                    return filter;
                }
            }
            function extractTimeFilter(requestParameter, queryFilters : Filter[]) : String {
                var propFilter : Filter = _.find(queryFilters, { filterClass: 'TimeFilter' });

                if (propFilter) {
                    queryFilters.splice(queryFilters.indexOf(propFilter), 1);
 
                    return "&starttime=" + propFilter.parameters.momentStart.utc().format() +
                           "&endtime=" + propFilter.parameters.momentEnd.utc().format();
                }
                else if (_.isString(requestParameter.defaultValue) && (requestParameter.defaultValue != '')) {
                    return '&' + requestParameter.defaultValue;
                }
            }
            function pointsWithinBBOX(BBOXCorners : number[]) : String {
                // Return evenly spaced points within the bbox
                //
                if (BBOXCorners.length != 4) {
                   throw new Error('Invalid bbox: ' + _.map(BBOXCorners).join(','));
                }

                let nPoints = 100;

                let dx = Math.abs(BBOXCorners[2] - BBOXCorners[0]);
                let dy = Math.abs(BBOXCorners[3] - BBOXCorners[1]);
                let len = Math.sqrt((dx * dy) / nPoints);
                let xStep = dx / Math.round((dx / len) - 1);
                let yStep = dy / Math.round((dy / len) - 1);
                let width = dx + xStep/2;
                let height = dy + yStep/2;
                let x0 = (BBOXCorners[0] < BBOXCorners[2]) ? BBOXCorners[0] : BBOXCorners[2];
                let y0 = (BBOXCorners[1] < BBOXCorners[3]) ? BBOXCorners[1] : BBOXCorners[3];
                let x,y,delim = '';
                let dataRequestParameter = '&latlons=';

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
            function extractBBOXFilter(requestParameter, queryFilters : Filter[]) : String {
                let propFilter : Filter = _.find(queryFilters, { filterClass: 'BBOXFilter' });

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
                        let numStrArr = requestParameter.defaultValue.substring(5).split(',');
                        let BBOX = [];

                        for (let i = 0, len = numStrArr.length; (i < len); i++) {
                            BBOX.push(Number(numStrArr[i]));
                        }

                        return pointsWithinBBOX(BBOX);
                    }
                }
            }
            function extractAdditionalFilter(requestParameter, queryFilters : Filter[]) : String {
                // e.g. place=Helsinki[,Turku,...]
                if (additionalFilter && (_.keys(additionalFilter.parameters.parameters).indexOf(requestParameter.propertyName) >= 0)) {
                    let filter = requestParameter.parameterName;
                    let nElem = 0;

                    _.forEach(decodeURIComponent(additionalFilter.parameters.parameters[requestParameter.propertyName]).split(','), (param) => {
                        filter += (((nElem++ == 0) ? "" : ",") + encodeURIComponent(param.trim()));
                    });

                    return filter;
                }
            }
            function extractAdditionalCoordinateFilter(requestParameter, queryFilters : Filter[]) : String {
                // latlon=lat,lon[,lat,lon,...] or lonlat=lon,lat[,lon,lat,...]
                if (additionalFilter && (_.keys(additionalFilter.parameters.parameters).indexOf(requestParameter.propertyName) >= 0)) {
                    let filter = requestParameter.parameterName;
                    let nElem = 0;
                    let nextCoordIsLat = (requestParameter.propertyName == 'latlon');
                    let coords = additionalFilter.parameters.parameters[requestParameter.propertyName];
                    if (_.isArray(coords)) {
                        coords = coords.join(',');
                    }
                    coords = coords.split(',');

                    if ((coords.length < 2) || ((coords.length % 2) != 0)) {
                        throw new Error('Invalid number of ' + requestParameter.propertyName + ' coordinate values: ' +
                                        additionalFilter.parameters.parameters[requestParameter.propertyName]);
                    }

                    _.forEach(coords, (coord) => {
                        let coordOk = false;
                        let value : Number;

                        if (!isNaN(coord)) {
                            value = Number(coord);
                            let minValue = (nextCoordIsLat ? -90 : -180);
                            let maxValue = (nextCoordIsLat ? 90 : 180);

                            coordOk = ((value >= minValue) && (value <= maxValue))
                        }

                        if (!coordOk) {
                            throw new Error('Invalid ' + requestParameter.propertyName + ' coordinate value: ' + coord);
                        }

                        filter += (((nElem++ == 0) ? "" : ",") + value);

                        nextCoordIsLat = (!nextCoordIsLat);
                    });

                    return filter;
                }
            }

            // data backend request parameters extracted from filters
            //
            let BBOXQueryType = collection.enumerable ? 'bbox' : 'points';
            let locationParams = collection.neareststations ? 'stationlat as lat,stationlon as lon'
                                                            :  'lat as lat,lon as lon';
            let timeParams = 'utctime as phenomenonTime,origintime as resultTime';

            const dataRequestParameterMap = new Map([
                [
                 'observedpropertyname',
                 new OptionalDataRequestParameter(
                                                  '&param=' + locationParams + ',' + timeParams,
                                                  'observedpropertyname',
                                                  extractPropertyFilter, collection.defaultParameters
                                                 )
                ]
               ,[ 'time', new OptionalDataRequestParameter('&datetime=', 'datetime', extractTimeFilter, collection.defaultTime) ]
               ,[ 'place', new RequiredGroupDataRequestParameter('location', '&places=', 1, 'place', extractAdditionalFilter, null) ]
               ,[ 'latlon', new RequiredGroupDataRequestParameter('location', '&latlons=', 1, 'latlon', extractAdditionalCoordinateFilter, null) ]
               ,[ 'lonlat', new RequiredGroupDataRequestParameter('location', '&lonlats=', 1, 'lonlat', extractAdditionalCoordinateFilter, null) ]
               ,[ 'bbox', new RequiredGroupDataRequestParameter('location', '&bbox=', 0, BBOXQueryType, extractBBOXFilter, collection.defaultLocation) ]
            ]);

            let parameterGroups = new Set();
            let defaultLocation = collection.defaultLocation;
            let dataRequestParameters = [ '' ];
            let nParams : number = 0;
            let nearestStations : boolean = (collection.neareststations ? true : false);

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

                let dataRequestParameter = requestParameter.filterFunction(requestParameter, queryFilters, paramMap);

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

                    if (dataRequestParameters.length <= requestParameter.parameterGroupIndex)
                      dataRequestParameters.push(dataRequestParameter)
                    else
                      dataRequestParameters[requestParameter.parameterGroupIndex] += dataRequestParameter;

                    if (parameterName == 'observedpropertyname') {
                        nParams = (((dataRequestParameter.match(/,/g) || []).length) + 1);
                        nParams += ((dataRequestParameter.match(/%2C/g) || []).length) - 4; // -4; lat,lon,utctime,origintime
                    }
                    else if (parameterName == 'bbox')
                        nearestStations = false;
                }
            }

            if (parameterGroups.size > 0) {
                // Default location was not bbox or place; use as is
                //
                dataRequestParameters[0] += ('&' + collection.defaultLocation);
            }

            if ((!nearestStations) && (dataRequestParameters.length > 1))
                // Other than latlon/lonlat location(s) are used, not fetching nearest station(s);
                // pop/remove second (latlon) element from parameter array and append it to first element
                //
                dataRequestParameters[0] += dataRequestParameters.pop();

            // Adjust max number of rows and nextToken to the start of first row for timeseries
            //
            // Note: currently data must be fetched starting from 1'st row, because number of locations
            // (i.e. number of values nParams * nLocations) per row is unknown
            //
            // nextTokenRow.row = Math.floor(nextTokenRow.nextToken / nParams);

            nextTokenRow.row = 0;
            nextTokenRow.curToken = nextTokenRow.row * nParams;

            if (collection.timeserieoutput || !collection.timeserieoutput) {
                // Note: currently all data must be fetched because number of timeserie timesteps is unknown,
                //       and missing values (null's) are filtered off for non timeserie output
                //
                nextTokenRow.limit = 0;
            }
            else {
                let n = nextTokenRow.limit + (nextTokenRow.nextToken - nextTokenRow.curToken);
                nextTokenRow.limit = Math.floor(n / nParams) + (((n % nParams) > 0) ? 1 : 0);
            }

            console.debug('nParams',nParams,'next',nextTokenRow.nextToken,'row',nextTokenRow.row,'cur',nextTokenRow.curToken,'lim',nextTokenRow.limit);

            return dataRequestParameters;
        }

        function dataRequestUrl(collection : GeoJSONCollection, dataRequestParameters : String, startRow : Number, limit : Number) : String {
            let request = collection.server + '/timeseries?producer=' + collection.producer + dataRequestParameters +
                          '&startrow=' + String(startRow) + '&maxresults=' + String(limit) +
                          '&format=json&missingtext=null&tz=UTC' + collection.timestep;
            console.debug(request);

            return request;
        }

        async function dataQuery(collection : GeoJSONCollection, nextTokenRow, limit : number, ret) {
            class Geometry implements GeoJSONGeometry {
                type : string;
                coordinates : Number[];

                constructor() {
                    this.type = 'Point';
                    this.coordinates = [ ];
                }
            }

            const http = require('http');
            const got = require('got');
            let paramMap = new Map();
            let requestParameters = extractDataQueryParameters(collection, ret.remainingFilter, nextTokenRow, paramMap);

            collection.featureId.producer = collection.producer;

            // For nearest station(s) (latlon) query the latlon(s) are stored at parameter arrays 2. index

            let locations = [];
            let rowLimit = nextTokenRow.limit;
            let nextToken = 0;
            let outputCount = 0;

            if (requestParameters.length > 1) {
                let queryParams = requestParameters[1].split("&");

                for (let p = 1; (p < queryParams.length); p++) {
                    let setting = queryParams[p].split("=");
                    let params = collection.neareststations + "&" + setting[0];
                    let values = setting[1].split(",");
                    let inc = ((setting[0] == "places") ? 1 : 2);

                    for (let v = 0; (v < values.length); v += inc) {
                        if (inc == 1)
                            locations.push(params + "=" + values[v]);
                        else
                            locations.push(params + "=" + values[v] + "," + values[v + 1]);
                    }
                }

                if (nextTokenRow.nextToken >= locations.length) {
                    ret.push(null);
                    return ret;
                }

                rowLimit = (collection.timeserieoutput ? collection.timeserierowlimit : 1);
                nextTokenRow.row = 0;
                nextToken = nextTokenRow.curToken = nextTokenRow.nextToken;
            }
            else
                locations.push("");

            for (let locIndex = nextToken; (locIndex < locations.length) && (outputCount < limit); locIndex++) {
                if (locIndex > 0)
                    nextTokenRow.row = 0;

                let reqParameters = requestParameters[0] + locations[locIndex];
                await got.get(dataRequestUrl(collection, reqParameters, nextTokenRow.row, rowLimit),
                              {responseType: 'json'})
                .then(response => {
                    let rows;
                    let rowIdx = 0;

                    try {
                        rows = ((response.body.length > 0) ? JSON.parse(response.body) : Array());
                        console.debug('Rows',rows.length);
                    }
                    catch (err) {
                        console.error('Response parsing error: ' + err.message);

                        ret.push(err);
                        ret.push(null);
                        return;
                    }

                    function nextRow() {
                        if ((rowIdx < rows.length) && (outputCount < limit)) {
                            const cfeature = new dataFeature();
                            produce(cfeature, feature => {

                            feature.properties['observationType'] = 'MeasureObservation';
                            feature.geometry = new Geometry();
                            let row = rows[rowIdx++];
                            let data = { };
                            let N = 1;
                            nextTokenRow.row++;

                            Object.keys(row).forEach((col) => {
                                if ((col == 'phenomenonTime') || (col == 'resultTime'))  {
                                    // Use phenomenon time as result time for observations
                                    //
                                    let c = (((col == 'resultTime') && collection.enumerable) ? 'phenomenonTime' : col);
                                    feature.properties[col] = row[c];
                                }
                                else if ((col != 'lat') && (col != 'lon')) {
                                    data[col] = row[col];
                                }
                            });

                            Object.keys(data).forEach((param) => {
                                // Without 'timestep' timeseries may return less values than coordinates when there are missing (N/A)
                                // values (e.g. minute resolution observations available for only some of the stations).
                                //
                                let arrayValue = _.isArray(data[param]);
                                let arrayCoord = _.isArray(row['lon']);
                                let numValues = arrayValue ? data[param].length : 1;
                                let numCoords = arrayCoord ? row['lon'].length : 1;
                                let valIdx = 0;

                                if (numValues != numCoords) {
                                    console.debug(paramMap[param] + ' value/coordinate count mismatch ' +
                                                  feature.properties['phenomenonTime'],numValues,numCoords);
                                    numValues = (numValues > numCoords ? numCoords : numValues);
                                }

                                collection.featureId.parameter = paramMap[param];

                                while ((valIdx < numValues) && (outputCount < limit)) {
                                    let result = arrayValue ? data[param][valIdx] : data[param];

                                    if (result != 'null') {
                                        if (nextTokenRow.curToken++ >= nextTokenRow.nextToken) {
                                            feature.properties['observedPropertyName'] = paramMap[param];
                                            feature.properties['result'] = result;
                                            let lon = arrayCoord ? row['lon'][valIdx] : row['lon'];
                                            let lat = arrayCoord ? row['lat'][valIdx] : row['lat'];
                                            feature.geometry.coordinates[0] = lon;
                                            feature.geometry.coordinates[1] = lat;

                                            collection.featureId.generation = feature.properties['resultTime'];
                                            collection.featureId.area = _.toString(lat) + ',' + _.toString(lon);
                                            collection.featureId.time = feature.properties['phenomenonTime'];
                                            feature.id = idToString(collection.featureId);

                                            if (ret.push(new dataItem(feature,++nextTokenRow.nextToken))) {
                                                outputCount++;
                                            }
                                            else
                                                console.debug('Filter',nextTokenRow.nextToken,param,arrayValue ? data[param][valIdx] : data[param]);
                                        }
                                    }

                                    valIdx++;
                                    N++;
                                }
                            });

                            })  // produce

                            setTimeout(nextRow, 5);
                        }
                        else if (((locIndex + 1) >= locations.length) || (outputCount >= limit))
                            ret.push(null);
                    }

                    let features = { }

                    function nextTimeSerieRow() {
                        const cfeature = new dataFeature();
                        produce(cfeature, feature => {
                        feature = null;

                        if ((rowIdx < rows.length) && (outputCount < limit)) {
                            let row = rows[rowIdx++];
                            let data = { };
                            let timeColumns = { }
                            nextTokenRow.row++;

                            Object.keys(row).forEach((col) => {
                                if ((col == 'phenomenonTime') || (col == 'resultTime'))  {
                                    // Use phenomenon time as result time for observations
                                    //
                                    let c = (((col == 'resultTime') && collection.enumerable) ? 'phenomenonTime' : col);
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
                                let arrayValue = _.isArray(data[param]);
                                let arrayCoord = _.isArray(row['lon']);
                                let numValues = arrayValue ? data[param].length : 1;
                                let numCoords = arrayCoord ? row['lon'].length : 1;
                                let valIdx = 0;

                                if (numValues != numCoords) {
                                    console.debug(paramMap[param] + ' value/coordinate count mismatch ' +
                                                  timeColumns['phenomenonTime'],numValues,numCoords);
                                    numValues = (numValues > numCoords ? numCoords : numValues);
                                }

                                while ((valIdx < numValues) && (outputCount < limit)) {
                                    feature = features[param];

                                    if (feature) {
                                        if (
                                            ((arrayCoord ? row['lon'][valIdx] : row['lon']) != feature.geometry.coordinates[0]) ||
                                            ((arrayCoord ? row['lat'][valIdx] : row['lat']) != feature.geometry.coordinates[1])
                                           ) {
                                            if (nextTokenRow.curToken++ >= nextTokenRow.nextToken) {
                                                if (collection.neareststations) {
                                                    // Location changes, ignore rest of the data
                                                    //
                                                    rowIdx = rows.length;
                                                    break;
                                                }

                                                collection.featureId.parameter = feature.properties['observedPropertyName'];
                                                collection.featureId.time = collection.featureId.time0 + '/' + collection.featureId.timeN;
                                                feature.id = idToString(collection.featureId);

                                                if (ret.push(new dataItem(feature,++nextTokenRow.nextToken))) {
                                                    if (++outputCount >= limit)
                                                        break;
                                                }
                                            }

                                            feature = null;
                                         }
                                    }

                                    if (!feature) {
                                        feature = new dataFeature();

                                        feature.properties['observationType'] = 'MeasureTimeseriesObservation';
                                        feature.properties['timestep'] = [ ];
                                        feature.geometry = new Geometry();

                                        feature.properties['observedPropertyName'] = paramMap[param];
                                        feature.properties['result'] = [ ];
                                        let lon = arrayCoord ? row['lon'][valIdx] : row['lon'];
                                        let lat = arrayCoord ? row['lat'][valIdx] : row['lat'];
                                        feature.geometry.coordinates[0] = lon;
                                        feature.geometry.coordinates[1] = lat;
                                        features[param] = feature;

                                        collection.featureId.generation = timeColumns['resultTime'];
                                        collection.featureId.time0 = timeColumns['phenomenonTime'];
                                        collection.featureId.area = _.toString(lat) + ',' + _.toString(lon);
                                    }

                                    let resIdx = feature.properties['result'].length;

                                    feature.properties['result'][resIdx] = arrayValue ? data[param][valIdx] : data[param];
                                    feature.properties['timestep'][resIdx] = timeColumns['phenomenonTime'];

                                    collection.featureId.timeN = timeColumns['phenomenonTime'];

                                    valIdx++;
                                }
                            });

                            setTimeout(nextTimeSerieRow, 5);
                        }
                        else {
                            if (outputCount < limit) {
                                Object.keys(features).forEach((param) => {
                                    if ((outputCount < limit) && (nextTokenRow.curToken++ >= nextTokenRow.nextToken)) {
                                        feature = features[param];
                                        collection.featureId.parameter = feature.properties['observedPropertyName'];
                                        collection.featureId.time = collection.featureId.time0 + '/' + collection.featureId.timeN;
                                        feature.id = idToString(collection.featureId);

                                        ret.push(new dataItem(feature,++nextTokenRow.nextToken));
                                        outputCount++;
                                    }
                                })
                            }

                            if (((locIndex + 1) >= locations.length) || (outputCount >= limit))
                                ret.push(null);
                        }

                        })  // produce
                    }

                    if (collection.timeserieoutput) {
                        nextTimeSerieRow();
//                      setTimeout(nextTimeSerieRow, 5);
                    }
                    else {
                        nextRow();
//                      setTimeout(nextRow, 5);
                    }
                })
                .catch(err => {
                    console.error('Data query error: ' + err.message);
                    /*
                    let feature = new dataFeature();
                    feature.properties['observationType'] = 'MeasureTimeseriesObservation';
                    feature.properties['timestep'] = [ ];
                    feature.geometry = new Geometry();
                    feature.properties['observedPropertyName'] = err.message;
                    feature.properties['result'] = [ ];
                    feature.geometry.coordinates[0] = 0;
                    feature.geometry.coordinates[1] = 0;
                    ret.push(new dataItem(feature,0));
                    */
                    ret.push(new Error(err.message));
                    ret.push(null);
                });
            }  // for locIndex
        }

        let nextTokenRow = { nextToken: nextToken, curToken: nextToken, row: 0, limit: query.limit };

        dataQuery(this, nextTokenRow, query.limit, ret);

        return ret;
    }

    getFeatureById(id : string) : Promise<Feature> {
        let ret = new Promise<Feature>((resolve) => {
            setTimeout(() => {
                let feature = (_.isObject(this.data) ? _.find(this.data.features, f => f.properties.id === id) : null);
                resolve(feature);
            }, 5);
        });

        return ret;
    }
};

export {SofpSmartmetBackend};
