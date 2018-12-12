import {SofpExampleBackend} from './';

test('Example backend has single collection', () => {
    expect(SofpExampleBackend.collections.length).toBe(1);
});

test('Example backend collection, no filter, returns 7 features', done => {
    var stream = SofpExampleBackend.collections[0].executeQuery({
        nextToken: null,
        limit: 7,
        featureName: SofpExampleBackend.collections[0].name,
        filters: []
    });

    var objectsReceived = 0;
    stream.on('data', obj => {
        objectsReceived++;
    });

    stream.on('end', () => {
        expect(objectsReceived).toBe(7);
        done();
    });
});

test('Example backend collection, filter that discards every other feature, skip 50 & limit 100, returns 25 features', done => {
    var n = 0;
    var stream = SofpExampleBackend.collections[0].executeQuery({
        nextToken: '50',
        limit: 100,
        featureName: SofpExampleBackend.collections[0].name,
        filters: [{
            accept: f => {
                return (n++ % 2) === 0;
            }
        }]
    });

    var objectsReceived = 0;
    var receivedIds = [];
    stream.on('data', obj => {
        receivedIds.push(obj.feature.properties.gml_id);
        objectsReceived++;
    });

    stream.on('end', () => {
        expect(objectsReceived).toBe(25);
        expect(receivedIds[0]).toBe('BsWfsElement.1.11.1');
        expect(receivedIds[24]).toBe('BsWfsElement.1.20.4');
        done();
    });
});


test('Example backend collection, skip 95, limit 10, returns 5 features (since collection has 100)', done => {
    var n = 0;
    var stream = SofpExampleBackend.collections[0].executeQuery({
        nextToken: '95',
        limit: 10,
        featureName: SofpExampleBackend.collections[0].name,
        filters: [{
            accept: f => {
                return (n++ % 2) === 0;
            }
        }]
    });

    var objectsReceived = 0;
    var receivedIds = [];
    stream.on('data', obj => {
        receivedIds.push(obj.feature.properties.gml_id);
        objectsReceived++;
    });

    stream.on('end', () => {
        expect(objectsReceived).toBe(3);
        expect(receivedIds[0]).toBe('BsWfsElement.1.20.1');
        expect(receivedIds[1]).toBe('BsWfsElement.1.20.3');
        expect(receivedIds[2]).toBe('BsWfsElement.1.20.5');
        done();
    });
});

test('Find feature by id (find it)', done => {
    var n = 0;
    SofpExampleBackend.collections[0].getFeatureById('BsWfsElement.1.20.1').then(f => {
        expect(f).toBeDefined();
        expect(f.properties.gml_id).toBe('BsWfsElement.1.20.1');
        done();
    });
});

test('Attempt to find a feature with an non-existing id', done => {
    var n = 0;
    SofpExampleBackend.collections[0].getFeatureById('non-existent').then(f => {
        expect(f).toBeUndefined();
        done();
    });
});
