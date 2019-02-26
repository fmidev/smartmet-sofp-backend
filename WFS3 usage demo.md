
This is a very simple demo how to use FMI WFS 3 service with owslib library. Please refer https://geopython.github.io/OWSLib/#wfs-3-0 for more information. 


```python
from owslib.wfs import WebFeatureService
w = WebFeatureService('http://beta.fmi.fi/data/3/wfs/sofp', version='3.0')                      
```

Get information about collections:


```python
collections = w.collections()
for c in collections:
    print(c['name']+': '+c['title'])
    print(c['description'])
    print(' ')
```

    hirlam: hirlam
    FMI hirlam surface forecast data. Default parameter set contains following parameters: GeopHeight,Temperature,Pressure,Humidity,WindDirection,WindSpeedMS,WindUMS,WindVMS,MaximumWind,WindGust,DewPoint,TotalCloudCover,WeatherSymbol3,LowCloudCover,MediumCloudCover,HighCloudCover,Precipitation1h,PrecipitationAmount,RadiationGlobalAccumulation,RadiationLWAccumulation,RadiationNetSurfaceLWAccumulation,RadiationNetSurfaceSWAccumulation,RadiationDiffuseAccumulation,LandSeaMask
     
    harmonie_scandinavia_surface: harmonie_scandinavia_surface
    FMI harmonie scandinavia surface forecast data. Default parameter set contains following parameters: GeopHeight,Temperature,Pressure,Humidity,WindDirection,WindSpeedMS,WindUMS,WindVMS,MaximumWind,WindGust,DewPoint,TotalCloudCover,WeatherSymbol3,LowCloudCover,MediumCloudCover,HighCloudCover,Precipitation1h,PrecipitationAmount,RadiationGlobalAccumulation,RadiationLWAccumulation,RadiationNetSurfaceLWAccumulation,RadiationNetSurfaceSWAccumulation,RadiationDiffuseAccumulation,LandSeaMask
     
    opendata_1m: opendata 1m
    FMI observation data. Default parameter set contains following parameters: Temperature,Pressure,Humidity,WindDirection,WindSpeedMS,WindGust,DewPoint,TotalCloudCover,Precipitation1h
     
    opendata_10m: opendata 10m
    FMI observation data. Default parameter set contains following parameters: Temperature,Pressure,Humidity,WindDirection,WindSpeedMS,WindGust,DewPoint,TotalCloudCover,Precipitation1h
     
    opendata_1h: opendata 1h
    FMI observation data. Default parameter set contains following parameters: Temperature,Pressure,Humidity,WindDirection,WindSpeedMS,WindGust,DewPoint,TotalCloudCover,Precipitation1h
     


Get data (first 10 elements):


```python
data = w.collection_items('opendata_10m')
for d in data['features']:
    print('{} ({} |{},{}): {}'.format(d['properties']['observedPropertyName'].rjust(20),
                                      d['properties']['resultTime'],
                                      d['geometry']['coordinates'][0],
                                      d['geometry']['coordinates'][1],
                                      d['properties']['result']))

```

             Temperature (20190225T105000 |21.02681,60.7222): 4
                Pressure (20190225T105000 |21.02681,60.7222): 1021
                Humidity (20190225T105000 |21.02681,60.7222): 77
           WindDirection (20190225T105000 |21.02681,60.7222): 313
             WindSpeedMS (20190225T105000 |21.02681,60.7222): 15
                WindGust (20190225T105000 |21.02681,60.7222): 17
                DewPoint (20190225T105000 |21.02681,60.7222): 0
         TotalCloudCover (20190225T105000 |21.02681,60.7222): 0
         Precipitation1h (20190225T105000 |21.02681,60.7222): null
             Temperature (20190225T110000 |21.02681,60.7222): 4

