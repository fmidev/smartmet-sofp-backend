# Sofp Smartmet Backend

This is FMI smartmet-server backend for Simple Observation Features Pilot WFS 3.0 project.

Demo service is available at: http://beta.fmi.fi/data/3/wfs/sofp The service provides Hirlam and Harmonie weather forecasts and weather observations from Finland. The service is published as a demo and FMI will give no warranty about it. See section [Interface](#Interface) for more details.

The complete project is located in several repositories. Core is available at https://github.com/vaisala-oss/sofp-core. Simple Observation Features are defined and developed at https://github.com/opengeospatial/omsf-profile. Finally, a simple OpenLayers demo build upon this service is available at: https://vaisala-oss.github.io/sofp-demo/.

This backend is developed by Finnish Meteorological Institute. The whole project is done in collaboration with Vaisala and Spatineo. All software is under MIT license.

## Interface

This service follows [WFS 3.0 interface](https://cdn.rawgit.com/opengeospatial/WFS_FES/3.0.0-draft.1/docs/17-069.html). The most important links are:

|Page|Url|Description|
|-|-|-|
|Landing page| http://beta.fmi.fi/data/3/wfs/sofp | Contain information about the server and links to collections |
|Collection listing|http://beta.fmi.fi/data/3/wfs/sofp/collections | List of collections with links to actual data |
| Data (several) | For example: http://beta.fmi.fi/data/3/wfs/sofp/collections/hirlam/items | Data returned with default parameters |

Note that Landing page and collection listing support html encoding and return information as html if client sends corresponding headers. If html is not accepted by the client, JSON is returned.

All data requests can be filtered with default parameters property filters. Furthermore, we provide some extra _magic_ filters for user convenience. List of most important filters are:

|Filter|Description|Example|
|-|-|-|
|[BBOX](https://cdn.rawgit.com/opengeospatial/WFS_FES/3.0.0-draft.1/docs/17-069.html#_parameter_bbox)| Area filter | http://beta.fmi.fi/data/3/wfs/sofp/collections/hirlam/items?bbox=19,59,20,60 |
|place | Special filter to fetch data with a place name. If _place_ is given, other location filters are ignored. |http://beta.fmi.fi/data/3/wfs/sofp/collections/opendata_1m/items?place=kaisaniemi |
|[time](https://cdn.rawgit.com/opengeospatial/WFS_FES/3.0.0-draft.1/docs/17-069.html#_parameter_time)| Time filter. May be one timestamp or time range.|http://beta.fmi.fi/data/3/wfs/sofp/collections/opendata_1m/items?time=2018-02-26T08:00:00Z/2018-02-26T09:00:00Z |
|[limit](https://cdn.rawgit.com/opengeospatial/WFS_FES/3.0.0-draft.1/docs/17-069.html#_parameter_limit) | Number of responses returned (default 10) |http://beta.fmi.fi/data/3/wfs/sofp/collections/hirlam/items?bbox=19,59,20,60&limit=100 |
|[Property filter](https://cdn.rawgit.com/opengeospatial/WFS_FES/3.0.0-draft.1/docs/17-069.html#_parameters_for_filtering_on_feature_properties) | Filter based on any property in the response |http://beta.fmi.fi/data/3/wfs/sofp/collections/hirlam/items?limit=100&place=kaisaniemi&observedPropertyName=WindSpeedMS&phenomenonTime=20190225T080000 |
| Filtering by parameter [(property filter)](https://cdn.rawgit.com/opengeospatial/WFS_FES/3.0.0-draft.1/docs/17-069.html#_parameters_for_filtering_on_feature_properties) |Example how to use property filters to filter just parameters of interest |http://beta.fmi.fi/data/3/wfs/sofp/collections/hirlam/items?limit=100&place=kaisaniemi&observedPropertyName=WindSpeedMS,WindDirection |

In area requests (BBOX), returned forecast data is sample from the whole data by default. By default it contain 10 points distributed regularly over given BBOX. Amount of returned points can be controlled with _limit_ parameter. If _place_ parameter is given, BBOX is ignored and data is returned from exact requested location.

Observations are always returned from actual observation stations. In BBOX requests, all stations inside requested area is returned. In _place_ requests, data is returned from the nearest observation station of requested location.

Data content is the same with [FMI OpenData portal](https://en.ilmatieteenlaitos.fi/open-data). In short: full history of observations is kept in the service but forecasts are available only from current moment to two days ahead. Please refer to [FMI OpenData instructions](https://en.ilmatieteenlaitos.fi/open-data) for more details.

### Examples

Example requests are listed in filter table above.

GDAL >= 2.3.0 can be used to fetch information from WFS 3.0 (see [more instructions](https://gdal.org/drv_wfs3.html)):

```
~ > ogrinfo WFS3:http://beta.fmi.fi/data/3/wfs/sofp
INFO: Open of `WFS3:http://beta.fmi.fi/data/3/wfs/sofp'
      using driver `WFS3' successful.
1: hirlam (Point)
2: harmonie_scandinavia_surface
3: opendata_1m (Point)
4: opendata_10m (Point)
5: opendata_1h (Point)
```

```
>ogrinfo WFS3:http://beta.fmi.fi/data/3/wfs/sofp hirlam -al -q

Layer name: hirlam
Metadata:
  DESCRIPTION=FMI hirlam surface forecast data. Default parameter set contains following parameters: GeopHeight,Temperature,Pressure,Humidity,WindDirection,WindSpeedMS,WindUMS,WindVMS,MaximumWind,WindGust,DewPoint,TotalCloudCover,WeatherSymbol3,LowCloudCover,MediumCloudCover,HighCloudCover,Precipitation1h,PrecipitationAmount,RadiationGlobalAccumulation,RadiationLWAccumulation,RadiationNetSurfaceLWAccumulation,RadiationNetSurfaceSWAccumulation,RadiationDiffuseAccumulation,LandSeaMask
  TITLE=hirlam
OGRFeature(hirlam):1
  observationType (String) = MeasureObservation
  resultTime (String) = 20190226T090000
  phenomenonTime (String) = 20190226T010000
  id (String) = BsWfsElement.1.1.1
  observedPropertyName (String) = GeopHeight
  result (Integer) = 1
  POINT (19.1 59.7)

OGRFeature(hirlam):2
  observationType (String) = MeasureObservation
  resultTime (String) = 20190226T090000
  phenomenonTime (String) = 20190226T010000
  id (String) = BsWfsElement.1.1.2
  observedPropertyName (String) = Temperature
  result (Integer) = 4
  POINT (19.1 59.7)

  [...]
  ```

Please see [WFS3 usage demo](WFS3 usage demo.md) for python example.

## Developing

Prerequisites: smartmet backend uses smartmet-server's timeseries plugin to fetch data. Clone, build, configure and run FMI smartmet-server (https://github.com/fmidev/smartmet-server). Backend's configuration lists the data producers (i.e. producers configured for smartmet-server's querydata engine) for the available collections.

You can run the entire sofp server with this backend using ```npm start```. This will watch the typescript source files, recompile when necessary and restart the server. For this to work, sofp-core must be cloned alongside this backend module directory and compiled (npm install, npm run build).

The step-by-step is as follows:

```
  cd /where/you/store/projects
  git clone https://github.com/vaisala-oss/sofp-core.git
  git clone https://github.com/fmidev/smartmet-sofp-backend.git
  cd sofp-core
  npm install && npm run build
  cd ..
  cd smartmet-sofp-backend
  (edit configuration file cnf/smartmet.json; configure smartmet-server url and collections)
  npm start
```

## Packaging

Backends are packaged as docker containers that are built on top of the sofp-core container. A full server is the core + at least one backend. Multiple backends can be packaged by chaining together backends so that the first backend starts from the sofp-core container, then next uses the output of the previous backend container and so forth until all backends are included.

To build this particular mock backend, you can use the Dockerfile in the repository along this documentation. Clone the project, then run:

  `docker build --no-cache -t sofp/smartmet-backend .``

To start the image (removing the container when stopped):

  `docker run --rm -p 127.0.0.1:8080:3000/tcp sofp/smartmet-backend`
