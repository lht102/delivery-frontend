dayjs.extend(window.dayjs_plugin_utc);
dayjs.extend(window.dayjs_plugin_customParseFormat);

const gServerURL = 'http://localhost:8080';

const gHongKongCityLatLng = [22.302711, 114.177216];

const gSupportedIconColor = [
  '#808080',
  '#000000',
  '#FF0000',
  '#800000',
  '#FFFF00',
  '#808000',
  '#00FF00',
  '#008000',
  '#00FFFF',
  '#008080',
  '#0000FF',
  '#000080',
  '#FF00FF',
  '#800080',
];

const gArrowheadsCfg = {
  frequency: '50px',
  size: '12px',
};

// delivery-request-src-loc, delivery-request-dst-loc, driver-request-loc
var gPrevFocusLatLngInput = '';

var gPreviousMetricResult = null;

var gBtnAddDeliveryRequestClickCnt = 0;
var gBtnAddDriverRequestClickCnt = 0;

var gShowSimulationRequestFlag = $('#cb-show-simulation-request').is(
  ':checked'
);
var gShowSimulationResponseFlag = $('#cb-show-simulation-response').is(
  ':checked'
);

var gSelectedLatLngMaker = null;
var gSimulationRequestLayer = null;
var gSimulationResponseLayerByDriverUUID = null;

var gSimulationRequest = getDefaultEmptySimulationRequest();

var gMap = L.map('map', {
  center: gHongKongCityLatLng,
  zoom: 13,
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution:
    'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
  id: 'mapbox/streets-v11',
}).addTo(gMap);

updateSimulationRequestRendering();

gMap.on('contextmenu', function (e) {
  const latlng = e.latlng;
  if (gSelectedLatLngMaker !== null) {
    gMap.removeLayer(gSelectedLatLngMaker);
  }
  gSelectedLatLngMaker = L.marker(latlng).addTo(gMap);
  $('#selected-lat').val(latlng.lat);
  $('#selected-lng').val(latlng.lng);
  if (gPrevFocusLatLngInput === 'delivery-request-src-loc') {
    $('#delivery-request-src-lat').val(latlng.lat);
    $('#delivery-request-src-lng').val(latlng.lng);
  } else if (gPrevFocusLatLngInput === 'delivery-request-dst-loc') {
    $('#delivery-request-dst-lat').val(latlng.lat);
    $('#delivery-request-dst-lng').val(latlng.lng);
  } else if (gPrevFocusLatLngInput === 'driver-request-loc') {
    $('#driver-request-loc-lat').val(latlng.lat);
    $('#driver-request-loc-lng').val(latlng.lng);
  }
});

gMap.on('mousemove', function (e) {
  const latlng = e.latlng;
  $('#current-lat').val(latlng.lat);
  $('#current-lng').val(latlng.lng);
});

$('.dtp').datetimepicker({
  format: 'd/m/Y H:i:s',
});

$('input').on('focus', function () {
  const id = $(this).attr('id');
  if (id === 'delivery-request-src-lat' || id === 'delivery-request-src-lng') {
    gPrevFocusLatLngInput = 'delivery-request-src-loc';
  } else if (
    id === 'delivery-request-dst-lat' ||
    id === 'delivery-request-dst-lng'
  ) {
    gPrevFocusLatLngInput = 'delivery-request-dst-loc';
  } else if (
    id === 'driver-request-loc-lat' ||
    id === 'driver-request-loc-lng'
  ) {
    gPrevFocusLatLngInput = 'driver-request-loc';
  }
});

$('#cb-show-simulation-request').on('click', function () {
  gShowSimulationRequestFlag = $(this).is(':checked');
  if (gSimulationRequestLayer === null) {
    return;
  }
  if (gShowSimulationRequestFlag) {
    gSimulationRequestLayer.addTo(gMap);
  } else {
    gMap.removeLayer(gSimulationRequestLayer);
  }
});

$('#cb-show-simulation-response').on('click', function () {
  gShowSimulationResponseFlag = $(this).is(':checked');
  if (gSimulationResponseLayerByDriverUUID === null) {
    return;
  }
  if (gShowSimulationResponseFlag) {
    for (var layerGroup of gSimulationResponseLayerByDriverUUID.values()) {
      layerGroup.addTo(gMap);
    }
  } else {
    for (var layerGroup of gSimulationResponseLayerByDriverUUID.values()) {
      gMap.removeLayer(layerGroup);
    }
  }
});

$('#btn-submit-simulation-request').on('click', function () {
  handleSimulationRequest(gSimulationRequest);
});

$('#btn-add-delivery-request').on('click', function () {
  request = {
    uuid: uuidv4(),
    name: 'Delivery Request ' + +gBtnAddDeliveryRequestClickCnt,
    goodsMetadata: {
      name: 'Goods ' + gBtnAddDeliveryRequestClickCnt,
      weight: parseFloat($('#delivery-request-goods-weight').val()),
      length: parseFloat($('#delivery-request-goods-length').val()),
      width: parseFloat($('#delivery-request-goods-width').val()),
      height: parseFloat($('#delivery-request-goods-height').val()),
    },
    srcLoc: {
      lat: parseFloat($('#delivery-request-src-lat').val()),
      lng: parseFloat($('#delivery-request-src-lng').val()),
    },
    dstLoc: {
      lat: parseFloat($('#delivery-request-dst-lat').val()),
      lng: parseFloat($('#delivery-request-dst-lng').val()),
    },
    srcTimeWindow: {
      startedAt: getDateTimeUTCFormatStr(
        $('#delivery-request-src-tw-started-at').val()
      ),
      endedAt: getDateTimeUTCFormatStr(
        $('#delivery-request-src-tw-ended-at').val()
      ),
    },
    dstTimeWindow: {
      startedAt: getDateTimeUTCFormatStr(
        $('#delivery-request-dst-tw-started-at').val()
      ),
      endedAt: getDateTimeUTCFormatStr(
        $('#delivery-request-dst-tw-ended-at').val()
      ),
    },
    createdAt: getDateTimeUTCFormatStr($('#delivery-request-created-at').val()),
  };
  gBtnAddDeliveryRequestClickCnt++;
  gSimulationRequest.deliveryRequests.push(request);
  updateSimulationRequestTextAreaAndTriggerRendering();
});

$('#btn-add-driver-request').on('click', function () {
  request = {
    uuid: uuidv4(),
    name: 'Driver ' + gBtnAddDriverRequestClickCnt,
    vehicleCapacity: {
      weight: parseInt($('#driver-request-vc-weight').val()),
      length: parseInt($('#driver-request-vc-length').val()),
      width: parseInt($('#driver-request-vc-width').val()),
      height: parseInt($('#driver-request-vc-height').val()),
    },
    maxSpeedKmPerHour: parseFloat($('#driver-request-max-speed').val()),
    loc: {
      lat: parseFloat($('#driver-request-loc-lat').val()),
      lng: parseFloat($('#driver-request-loc-lng').val()),
    },
    createdAt: getDateTimeUTCFormatStr($('#delivery-request-created-at').val()),
  };
  gBtnAddDriverRequestClickCnt++;
  gSimulationRequest.driverRequests.push(request);
  updateSimulationRequestTextAreaAndTriggerRendering();
});

$('#simulation-request-json').on('input', function () {
  updateSimulationRequestRendering();
});

$('#cb-support-retracement').on('click', function () {
  gSimulationRequest.supportRetracement = $(this).is(':checked');
  $('#simulation-request-json').val(
    JSON.stringify(gSimulationRequest, null, 2)
  );
});

$('#cb-alternative-driver-matching').on('click', function () {
  gSimulationRequest.useAlternativeForDriverMatching = $(this).is(':checked');
  $('#simulation-request-json').val(
    JSON.stringify(gSimulationRequest, null, 2)
  );
});

function createRouteAccordionElement(uuid, routingDetails) {
  let wrapper = $('<div>', {
    class: 'accordion',
    id: 'a-' + uuid,
  });
  for (let i = 0; i < routingDetails.routes.length; i++) {
    const route = routingDetails.routes[i];
    let item = $('<div>', {
      class: 'accordion-item',
    });
    let header = $('<h2>', {
      class: 'accordion-header',
      id: 'ah-' + uuid + '-route-' + i,
    });
    let headerBtn = $('<button>', {
      class: 'accordion-button collapsed',
      type: 'button',
      'data-bs-toggle': 'collapse',
      'data-bs-target': '#collapse-' + uuid + '-route-' + i,
      'aria-expanded': 'false',
      'aria-controls': 'collapse-' + uuid + '-route-' + i,
    }).html('Route ' + i);
    let collapseWrapper = $('<div>', {
      class: 'accordion-collapse collapse',
      id: 'collapse-' + uuid + '-route-' + i,
      'aria-labelledby': '#ah-' + uuid + '-route-' + i,
      'data-bs-parent': '#a-' + uuid,
    });
    let body = $('<div>', {
      class: 'accordion-body',
      id: 'ab-' + uuid + '-route-' + i,
    });
    body
      .append(
        $('<p>', {
          class: 'mb-1',
        }).html('Request uuid: ' + route.deliveryRequestUuid)
      )
      .append(
        $('<p>', {
          class: 'mb-1',
        }).html('Source lat: ' + route.srcLoc.lat)
      )
      .append(
        $('<p>', {
          class: 'mb-1',
        }).html('Source lnt: ' + route.srcLoc.lng)
      )
      .append(
        $('<p>', {
          class: 'mb-1',
        }).html('Destination lat: ' + route.dstLoc.lat)
      )
      .append(
        $('<p>', {
          class: 'mb-1',
        }).html('Destination lnt: ' + route.dstLoc.lng)
      )
      .append(
        $('<p>', {
          class: 'mb-1',
        }).html('Distance: ' + route.distance + ' km')
      )
      .append(
        $('<p>', {
          class: 'mb-1',
        }).html('Started At: ' + route.timeWindow.startedAt)
      )
      .append(
        $('<p>', {
          class: 'mb-1',
        }).html('Ended At: ' + route.timeWindow.endedAt)
      )
      .append(
        $('<p>', {
          class: 'mb-1',
        }).html('Speed: ' + route.speedKmPerHour + ' km/hr')
      )
      .append(
        $('<p>', {
          class: 'mb-1',
        }).html(
          'Vehicle capacity: ' +
            JSON.stringify(route.vehicleState.vehicleCapacity)
        )
      );
    for (let i = 0; i < route.vehicleState.boxItems.length; i++) {
      const boxItem = route.vehicleState.boxItems[i];
      body.append(
        $('<p>', {
          class: 'mb-1',
        }).html('Box Item ' + i + ': ' + JSON.stringify(boxItem))
      );
    }
    header.append(headerBtn);
    collapseWrapper.append(body);
    item.append(header, collapseWrapper);
    wrapper.append(item);
  }
  return wrapper;
}

function createMetricCard(headerText, result) {
  let card = $('<div>', {
    class: 'card',
  });
  let cardHeader = $('<div>', {
    class: 'card-header',
  }).html(headerText);
  let cardBody = $('<div>', {
    class: 'card-body p-0',
  });
  cardBody
    .append(
      $('<p>', { class: 'mx-2' }).html(
        'Num of delivery requests: ' + result.numOfDeliveryRequests
      )
    )
    .append(
      $('<p>', {
        class: 'mx-2',
      }).html('Num of drivers: ' + result.numOfDrivers)
    )
    .append(
      $('<p>', {
        class: 'mx-2',
      }).html('Num of served requests: ' + result.numOfServedRequests)
    )
    .append(
      $('<p>', {
        class: 'mx-2',
      }).html(
        'Percentage of served requests: ' +
          (
            (result.numOfServedRequests / result.numOfDeliveryRequests) *
            100
          ).toFixed(2) +
          '%'
      )
    )
    .append(
      $('<p>', {
        class: 'mx-2',
      }).html(
        'Average of served requests per driver: ' +
          (result.numOfServedRequests / result.numOfDrivers).toFixed(3)
      )
    )
    .append(
      $('<p>', {
        class: 'mx-2',
      }).html(
        'Average wait time for served requests: ' +
          (result.sumOftotalWaitTime / result.numOfServedRequests).toFixed(1) +
          ' seconds'
      )
    )
    .append(
      $('<p>', {
        class: 'mx-2',
      }).html(
        'Maximum wait time for a specific request: ' +
          result.maxTotalWaitTime +
          ' seconds'
      )
    )
    .append(
      $('<p>', {
        class: 'mx-2',
      }).html(
        'Average time to serve a request: ' +
          (result.sumTotalTimeSpent / result.numOfServedRequests).toFixed(1) +
          ' seconds'
      )
    )
    .append(
      $('<p>', {
        class: 'mx-2',
      }).html(
        'Average distance to serve a request: ' +
          (result.sumOfTotalDistance / result.numOfServedRequests).toFixed(3) +
          ' km'
      )
    )
    .append(
      $('<p>', {
        class: 'mx-2',
      }).html(
        'S.D. for num of served requests per driver: ' +
          result.numOfServedRequestsSD.toFixed(2)
      )
    );
  return card.append(cardHeader).append(cardBody);
}

function getMetricResult(simulationResp) {
  const numOfDeliveryRequests = Object.keys(
    simulationResp.deliveryRequestResultDetailsByUuid
  ).length;
  let numOfServedRequests = 0;
  let sumOftotalWaitTime = 0;
  let maxTotalWaitTime = 0;
  for (var uuid in simulationResp.deliveryRequestResultDetailsByUuid) {
    if (
      simulationResp.deliveryRequestResultDetailsByUuid.hasOwnProperty(uuid)
    ) {
      const requestResultDetails =
        simulationResp.deliveryRequestResultDetailsByUuid[uuid];
      if (requestResultDetails.isBeingServed) {
        numOfServedRequests++;
        sumOftotalWaitTime += parseInt(requestResultDetails.totalWaitTime);
        if (requestResultDetails.totalWaitTime > maxTotalWaitTime) {
          maxTotalWaitTime = requestResultDetails.totalWaitTime;
        }
      }
    }
  }

  const numOfDrivers = Object.keys(simulationResp.driverRoutingDetailsByUuid)
    .length;
  let sumOfTotalDistance = 0;
  let sumTotalTimeSpent = 0;
  let numOfServedRequestsArr = [];
  for (var uuid in simulationResp.driverRoutingDetailsByUuid) {
    if (simulationResp.driverRoutingDetailsByUuid.hasOwnProperty(uuid)) {
      const routingDetails = simulationResp.driverRoutingDetailsByUuid[uuid];
      sumOfTotalDistance += routingDetails.totalDistance;
      sumTotalTimeSpent += parseInt(routingDetails.totalTimeSpent);
      numOfServedRequestsArr.push(routingDetails.numOfServedRequests);
    }
  }

  return {
    numOfDeliveryRequests: numOfDeliveryRequests,
    numOfDrivers: numOfDrivers,
    numOfServedRequests: numOfServedRequests,
    sumOftotalWaitTime: sumOftotalWaitTime,
    maxTotalWaitTime: maxTotalWaitTime,
    sumOfTotalDistance: sumOfTotalDistance,
    sumTotalTimeSpent: sumTotalTimeSpent,
    numOfServedRequestsSD: getStandardDeviation(numOfServedRequestsArr),
  };
}

function getStandardDeviation(array) {
  const n = array.length;
  const mean = array.reduce((a, b) => a + b) / n;
  return Math.sqrt(
    array.map((x) => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n
  );
}

function createRoutingDetailsCard(uuid, routingDetails) {
  let card = $('<div>', {
    class: 'card',
  });
  let cardHeader = $('<div>', {
    class: 'card-header',
  }).html(routingDetails.name + '(' + uuid + ')');
  let cardBody = $('<div>', {
    class: 'card-body p-0',
  });
  let pTotalDist = $('<p>', {
    class: 'mx-2',
  }).html('Total distance: ' + routingDetails.totalDistance + ' km');
  let pTotalTimeSpent = $('<p>', {
    class: 'mx-2',
  }).html('Total time spent: ' + routingDetails.totalTimeSpent + ' seconds');
  let pNumOfServedRequests = $('<p>', {
    class: 'mx-2 mt-2',
  }).html('Number of served requests: ' + routingDetails.numOfServedRequests);
  cardBody.append(
    pNumOfServedRequests,
    pTotalDist,
    pTotalTimeSpent,
    createRouteAccordionElement(uuid, routingDetails)
  );
  return card.append(cardHeader).append(cardBody);
}

function createDeliveryRequestResultDetails(
  uuid,
  deliveryRequestResultDetailsByUuid
) {
  let card = $('<div>', {
    class: 'card',
  });

  let cardHeader = $('<div>', {
    class: 'card-header',
  }).html(deliveryRequestResultDetailsByUuid.name + '(' + uuid + ')');
  let cardBody = $('<div>', {
    class: 'card-body p-0',
  });
  let pIsServed = $('<p>', {
    class: 'mx-2',
  }).html('Is served: ' + deliveryRequestResultDetailsByUuid.isBeingServed);
  cardBody.append(pIsServed);
  if (deliveryRequestResultDetailsByUuid.isBeingServed) {
    let pTotalWaitTime = $('<p>', {
      class: 'mx-2',
    }).html(
      'Total wait time: ' +
        deliveryRequestResultDetailsByUuid.totalWaitTime +
        ' seconds'
    );
    cardBody.append(pTotalWaitTime);
  }
  return card.append(cardHeader).append(cardBody);
}

function parseJSON(response) {
  return new Promise((resolve) =>
    response.json().then((json) =>
      resolve({
        status: response.status,
        ok: response.ok,
        json,
      })
    )
  );
}

function handleSimulationRequest(simulationRequest) {
  fetch(gServerURL + '/delivery/simulation', {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(simulationRequest),
  })
    .then(parseJSON)
    .then((resp) => {
      if (resp.ok) {
        $('#wrapper-driver-routing-details').empty();
        $('#wrapper-delivery-request-result-details').empty();
        $('#wrapper-metric').empty();
        $('#select-show-routes-option').empty();

        if (gSimulationResponseLayerByDriverUUID !== null) {
          for (var layerGroup of gSimulationResponseLayerByDriverUUID.values()) {
            gMap.removeLayer(layerGroup);
          }
        }

        let driverIndexByUUID = new Map();
        for (let i = 0; i < simulationRequest.driverRequests.length; i++) {
          const driverReq = simulationRequest.driverRequests[i];
          driverIndexByUUID.set(driverReq.uuid, i);
        }

        let requestIndexByUUID = new Map();
        for (let i = 0; i < simulationRequest.deliveryRequests.length; i++) {
          const deliveryReq = simulationRequest.deliveryRequests[i];
          requestIndexByUUID.set(deliveryReq.uuid, i);
        }

        let simulationResponse = resp.json;
        gSimulationResponseLayerByDriverUUID = getLayerGroupByUUIDForSimulationResponse(
          driverIndexByUUID,
          simulationResponse
        );

        if (gShowSimulationResponseFlag) {
          for (var layerGroup of gSimulationResponseLayerByDriverUUID.values()) {
            layerGroup.addTo(gMap);
          }
        }
        let driverCardElements = [
          ...Array(
            Object.keys(simulationResponse.driverRoutingDetailsByUuid).length
          ),
        ];
        for (var uuid in simulationResponse.driverRoutingDetailsByUuid) {
          if (
            simulationResponse.driverRoutingDetailsByUuid.hasOwnProperty(uuid)
          ) {
            const routingDetails =
              simulationResponse.driverRoutingDetailsByUuid[uuid];
            driverCardElements[
              driverIndexByUUID.get(uuid)
            ] = createRoutingDetailsCard(uuid, routingDetails);
          }
        }
        $('#wrapper-driver-routing-details').append(...driverCardElements);

        let requestCardElements = [
          ...Array(
            Object.keys(simulationResponse.deliveryRequestResultDetailsByUuid)
              .length
          ),
        ];
        for (var uuid in simulationResponse.deliveryRequestResultDetailsByUuid) {
          if (
            simulationResponse.deliveryRequestResultDetailsByUuid.hasOwnProperty(
              uuid
            )
          ) {
            const requestResultDetails =
              simulationResponse.deliveryRequestResultDetailsByUuid[uuid];
            requestCardElements[
              requestIndexByUUID.get(uuid)
            ] = createDeliveryRequestResultDetails(uuid, requestResultDetails);
          }
        }
        $('#wrapper-delivery-request-result-details').append(
          ...requestCardElements
        );

        let metricResult = getMetricResult(simulationResponse);
        $('#wrapper-metric').append(
          createMetricCard('Current result', metricResult)
        );
        if (gPreviousMetricResult !== null) {
          $('#wrapper-metric').append(
            createMetricCard('Previous result', gPreviousMetricResult)
          );
        }
        gPreviousMetricResult = metricResult;

        setupRouteBodyOnClickEvents(
          simulationResponse.driverRoutingDetailsByUuid
        );
        setupSelectShowRoutesOption(
          driverIndexByUUID,
          simulationResponse.driverRoutingDetailsByUuid
        );
        return;
      }
      alert(resp.json.statusText + ', ' + resp.json.message);
    })
    .catch((err) => {
      alert(err.message);
    });
}

function setupRouteBodyOnClickEvents(driverRoutingDetailsByUuid) {
  for (var uuid in driverRoutingDetailsByUuid) {
    if (driverRoutingDetailsByUuid.hasOwnProperty(uuid)) {
      const routingDetails = driverRoutingDetailsByUuid[uuid];
      for (let i = 0; i < routingDetails.routes.length; i++) {
        const route = routingDetails.routes[i];
        $('#ab-' + uuid + '-route-' + i).on('click', function () {
          console.log('onclick');
          let polyline = L.polyline([
            latLngObjToArr(route.srcLoc),
            latLngObjToArr(route.dstLoc),
          ]);
          gMap.fitBounds(polyline.getBounds());
        });
      }
    }
  }
}

function setupSelectShowRoutesOption(
  driverIndexByUUID,
  driverRoutingDetailsByUuid
) {
  let optAll = $('<option>', {
    value: 'all',
  }).html('Show all routes');
  let opts = [...Array(Object.keys(driverRoutingDetailsByUuid).length)];
  for (var uuid in driverRoutingDetailsByUuid) {
    if (driverRoutingDetailsByUuid.hasOwnProperty(uuid)) {
      let opt = $('<option>', {
        value: uuid,
      }).html(
        'Show driver with index ' + driverIndexByUUID.get(uuid) + ' routes only'
      );
      opts[driverIndexByUUID.get(uuid)] = opt;
    }
  }
  $('#select-show-routes-option')
    .append(optAll, ...opts)
    .on('change', function () {
      for (var layerGroup of gSimulationResponseLayerByDriverUUID.values()) {
        gMap.removeLayer(layerGroup);
      }

      const uuid = $(this).val();
      if (uuid === 'all') {
        for (var layerGroup of gSimulationResponseLayerByDriverUUID.values()) {
          layerGroup.addTo(gMap);
        }
      } else {
        let layerGroup = gSimulationResponseLayerByDriverUUID.get(uuid);
        layerGroup.addTo(gMap);
      }
    });
}

function updateSimulationRequestTextAreaAndTriggerRendering() {
  $('#simulation-request-json').val(
    JSON.stringify(gSimulationRequest, null, 2)
  );
  updateSimulationRequestRendering();
}

function updateSimulationRequestRendering() {
  try {
    gSimulationRequest = JSON.parse($('#simulation-request-json').val());
    if (gSimulationRequest.deliveryRequests === undefined) {
      gSimulationRequest.deliveryRequests = [];
    }
    if (gSimulationRequest.driverRequests === undefined) {
      gSimulationRequest.driverRequests = [];
    }
    $('#cb-support-retracement').prop(
      'checked',
      gSimulationRequest.supportRetracement
    );
    $('#cb-alternative-driver-matching').prop(
      'checked',
      gSimulationRequest.useAlternativeForDriverMatching
    );
  } catch (e) {
    gSimulationRequest = getDefaultEmptySimulationRequest();
    return;
  }
  if (gSimulationRequestLayer !== null) {
    gMap.removeLayer(gSimulationRequestLayer);
  }
  gSimulationRequestLayer = getLayerGroupForSimulationRequest(
    gSimulationRequest
  );
  if (gShowSimulationRequestFlag) {
    gSimulationRequestLayer.addTo(gMap);
  }
}

function getLayerGroupForSimulationRequest(simulationRequest) {
  let polylines = [];
  let deliveryRequestMarkers = [];
  for (let i = 0; i < simulationRequest.deliveryRequests.length; i++) {
    const deliveryReq = simulationRequest.deliveryRequests[i];
    deliveryRequestMarkers.push(
      ...createDeliveryRequestMarkers(
        deliveryReq,
        i,
        getSupportedIconColorByIndex(i)
      )
    );
    polylines.push(
      createDeliveryRequestPolyline(
        deliveryReq,
        getSupportedIconColorByIndex(i)
      )
    );
  }
  let driverRequestMarkers = [];
  for (let i = 0; i < simulationRequest.driverRequests.length; i++) {
    const driverReq = simulationRequest.driverRequests[i];
    let marker = createNumberedMarker(
      latLngObjToArr(driverReq.loc),
      i,
      getSupportedIconColorByIndexReverse(i),
      'star'
    ).bindPopup(
      createHtmlParagraph(
        'uuid: ' + driverReq.uuid,
        'vehicleCapacity',
        'weight: ' + driverReq.vehicleCapacity.weight,
        'length: ' + driverReq.vehicleCapacity.length,
        'width: ' + driverReq.vehicleCapacity.width,
        'height: ' + driverReq.vehicleCapacity.height,
        'maxSpeedKmPerHour: ' + driverReq.maxSpeedKmPerHour,
        'createdAt: ' + driverReq.createdAt
      )
    );
    driverRequestMarkers.push(marker);
  }
  return L.layerGroup([
    ...deliveryRequestMarkers,
    ...polylines,
    ...driverRequestMarkers,
  ]);
}

function getLayerGroupByUUIDForSimulationResponse(
  driverIndexByUUID,
  simulationResponse
) {
  let layerGroupByDriverUUID = new Map();
  for (var uuid in simulationResponse.driverRoutingDetailsByUuid) {
    if (simulationResponse.driverRoutingDetailsByUuid.hasOwnProperty(uuid)) {
      let polylines = [];
      let driverRouteMarkers = [];
      const routingDetails =
        simulationResponse.driverRoutingDetailsByUuid[uuid];
      for (let i = 0; i < routingDetails.routes.length; i++) {
        const route = routingDetails.routes[i];
        const indexNum = driverIndexByUUID.get(uuid);
        driverRouteMarkers.push(
          ...createDriverRouteMarkers(
            route,
            indexNum,
            getSupportedIconColorByIndex(indexNum)
          )
        );
        polylines.push(
          createDriverRoutePolyline(
            route,
            getSupportedIconColorByIndex(indexNum)
          )
        );
      }
      layerGroupByDriverUUID.set(
        uuid,
        L.layerGroup([...driverRouteMarkers, ...polylines])
      );
    }
  }
  return layerGroupByDriverUUID;
}

function latLngObjToArr(latLng) {
  return [latLng.lat, latLng.lng];
}

function createDriverRouteMarkers(route, num, color) {
  return [
    createNumberedMarker(latLngObjToArr(route.srcLoc), num, color, 'penta'),
    createNumberedMarker(latLngObjToArr(route.dstLoc), num, color, 'penta'),
  ];
}

function createDeliveryRequestMarkers(deliveryReq, num, color) {
  return [
    createDeliveryRequestMarker(deliveryReq, num, color, true),
    createDeliveryRequestMarker(deliveryReq, num, color, false),
  ];
}

function createDeliveryRequestMarker(deliveryReq, num, color, isSrc) {
  let locType = 'destination';
  let loc = deliveryReq.dstLoc;
  let td = deliveryReq.dstTimeWindow;
  let shape = 'square';
  if (isSrc) {
    locType = 'source';
    loc = deliveryReq.srcLoc;
    td = deliveryReq.srcTimeWindow;
    shape = 'circle';
  }
  return createNumberedMarker(latLngObjToArr(loc), num, color, shape).bindPopup(
    createHtmlParagraph(
      'uuid: ' + deliveryReq.uuid,
      locType,
      'timeWindow',
      'startedAt: ' + td.startedAt,
      'endedAt: ' + td.endedAt,
      'createdAt: ' + deliveryReq.createdAt
    )
  );
}

function createDriverRoutePolyline(route, color) {
  return L.polyline(
    [latLngObjToArr(route.srcLoc), latLngObjToArr(route.dstLoc)],
    {
      color: color,
    }
  )
    .bindPopup(
      createHtmlParagraph(
        'deliveryReqUUID: ' + route.deliveryRequestUuid,
        'startedAt: ' + route.timeWindow.startedAt,
        'endedAt: ' + route.timeWindow.endedAt,
        'distance: ' + route.distance + ' km',
        'speedKmPerHour: ' + route.speedKmPerHour.toFixed(3) + ' km/hr',
        'numberOfItem: ' + route.vehicleState.boxItems.length
      )
    )
    .arrowheads(gArrowheadsCfg);
}

function createDeliveryRequestPolyline(deliveryReq, color) {
  return L.polyline(
    [latLngObjToArr(deliveryReq.srcLoc), latLngObjToArr(deliveryReq.dstLoc)],
    {
      color: color,
    }
  )
    .bindPopup(
      createHtmlParagraph(
        'uuid: ' + deliveryReq.uuid,
        'goodsMetadata',
        'name: ' + deliveryReq.goodsMetadata.name,
        'weight: ' + deliveryReq.goodsMetadata.weight,
        'length: ' + deliveryReq.goodsMetadata.length,
        'width: ' + deliveryReq.goodsMetadata.width,
        'height: ' + deliveryReq.goodsMetadata.height,
        'createdAt: ' + deliveryReq.createdAt
      )
    )
    .arrowheads(gArrowheadsCfg);
}

function createNumberedMarker(latLng, num, color, shape = 'circle') {
  let markerIcon = L.ExtraMarkers.icon({
    icon: 'fa-number',
    markerColor: color,
    number: num.toString(),
    shape: shape,
    svg: true,
  });
  return L.marker(latLng, { icon: markerIcon });
}

function getSupportedIconColorByIndex(idx) {
  let i = idx % gSupportedIconColor.length;
  return gSupportedIconColor[i];
}

function getSupportedIconColorByIndexReverse(idx) {
  let i = gSupportedIconColor.length - 1 - (idx % gSupportedIconColor.length);
  return gSupportedIconColor[i];
}

function createHtmlParagraph(...texts) {
  let s = '';
  for (let i = 0; i < texts.length; i++) {
    const element = texts[i];
    s += element + '<br>';
  }
  return s;
}

function getDateTimeUTCFormatStr(dt) {
  return dayjs(dt, 'DD-MM-YYYY HH:mm:ss').utc().format();
}

function getDefaultEmptySimulationRequest() {
  return {
    deliveryRequests: [],
    driverRequests: [],
    useAlternativeForDriverMatching: false,
    supportRetracement: false,
  };
}
