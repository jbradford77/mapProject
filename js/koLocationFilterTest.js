// This source code is provided under "The Code Project Open License (CPOL) 1.02"
// For usage information about this library, see article at
// http://www.codeproject.com/Articles/797591/Using-Knockout-js-to-Control-Cascading-Selects

// This knockout custom class function was added to take an array
// of property names and corresponding values and return an array of
// all objects that match one or more of the values for each passed property.

ko.observableArray.fn.loadByProperties = function (propNames, matchValues) {
    var self = this;
    return function () {
        var allItems = self(),
            matchingItems = [];
        for (var i = 0; i < allItems.length; i++) {
            var current = allItems[i];
            var ismatch = true;
            for (var j = 0; j < propNames.length; j++) {
                var propval = ko.unwrap(current[propNames[j]]);
                ismatch = true;
                for (var k = 0; k < matchValues[j].length; k++) {
                    var matchVal = matchValues[j][k];
                    if (matchVal) {
                        ismatch = propval == matchVal;
                        if (ismatch) break;
                    }
                }
                if (!ismatch) break;
            }
            if (ismatch) matchingItems.push(current);
        }
        return matchingItems;
    }
}


// selectFilter objects represent a heirarchical filter that uses a SELECT control.
function selectFilter(selectName, parentName, viewmodel, label, multi) {
    this.name = selectName; // property name to filter on
    this.parentName = parentName; // property name of parent select-filter object
    this.model = viewmodel; // view model for the page
    this.multiSelect = multi; // true if multiselect control (listbox)
    if (!label) label = this.name;
    this.nameLabel = label; // label text value for this control

    this.value = new ko.observable(); // selected value if not multiselect

    this.values = new ko.observableArray(); // selected values if multiselect

    this.availableValues = new ko.observableArray(); // the option list for this select box.  An observableArray can
    // be data-bound to a control on the page for automatic updating.

    this.availableItems = new ko.observableArray(); // filtered list of selected items after filtering by this SELECT.
    // this list is read by any child filter-selects to determine
    // available options.

    this.model.registerFilter(this); // add this filter to the list



    // for single select dropdown, returns default value
    this.defaultValue = function () {
        return 'Select a ' + this.nameLabel + '...';
    }


    // returns an array of any selected values, whether multiselect or not
    this.valueArray = function () {
        if (!this.multiSelect) {
            if (this.value() != this.defaultValue()) return [this.value()];
            else return [];
        } else return this.values();
    }


    // Re-compute the option value lists when a selection is made.
    // This function is not called anywhere except from within Knockout!
    this._applySelection = new ko.computed(function () {
        var vals = this.valueArray(); // This line's only purpose is to persuade knockout to link this function to value selection.
        this.model.resolveSelections(); // Tells the model to reload all the select controls and filter the result
    }, this);

    //var self = this;
    //self.value.subscribe(function () {
    //    if (!self.multiSelect)
    //        self.model.resolveSelections();
    //});
    //self.values.subscribe(function () {
    //    if (self.multiSelect)
    //        self.model.resolveSelections();
    //});


    // Get property value options available for this SELECT
    // and load them into the availableValues array.
    this.getAvailableValues = function (items) {
        var matchingValues = [];
        for (var i = 0; i < items.length; i++) {
            var current = items[i][this.name];
            if (matchingValues.indexOf(current) == -1) matchingValues.push(current);
        }
        if (!this.multiSelect) this.availableValues([this.defaultValue()].concat(matchingValues.sort()));
        else this.availableValues(matchingValues.sort());
    }


    // the string text to be displayed when a selection is made
    this.valueText = new ko.computed(function () {
        if (this.valueArray().length > 0 && this.valueArray()[0]) return this.valueArray().join(', ');
        return '';
    }, this);


    // function called by the view model to apply the selections to the option lists
    this.setAvailableOptions = function () {
        var parent = this.model.getSelectByName(this.parentName);
        var parentitems;
        if (parent) {
            this.model.setFilterOptions(parent);
            parentitems = parent.availableItems;
        } else parentitems = this.model.allItems;
        this.getAvailableValues(parentitems());
        // apply this filter to the parent items so child filter-selects can see it
        this.availableItems(parentitems.loadByProperties([this.name], [this.valueArray()])());
    }


    // Clear any selections.
    this.reset = function () {
        this.value(this.defaultValue());
        this.values([]);
        //this.recalc();
    };

}


function sfViewModel(_parent) {
    this.parent = _parent;
    this.allItems = new ko.observableArray(); // all the downloaded items
    this.selectedItems = new ko.observableArray(); // the currently selected items
    this.selectFilters = []; // all the select-filter objects
    this.activeFilters = new ko.observableArray(); // the currently active select-filters
    this.processedFilters = []; // a temp collection of select-filters already processed


    this.registerFilter = function (afilterSelect) {
        this.selectFilters.push(afilterSelect);
    }


    this.getSelectByName = function (name) {
        for (var i = 0; i < this.selectFilters.length; i++)
        if (this.selectFilters[i].name == name) return this.selectFilters[i];
        return null;
    }


    // initialize the view model with the object collection
    // and load the filter-select objects
    this.loadData = function (self) {
        return function (data) {
            self.allItems(data.AllItems);
            self.selectedItems(data.AllItems);
            if (self.loadSelectsFunc) self.loadSelectsFunc(self);
            self.resolveSelections();
            // applyBindings is required by knockout to initialize bindings.
            ko.applyBindings(self.parent);
        }
    }


    // Load homes collection from javascript array
    this.loadListFromArray = function (data) {
        this.loadData(this)(data);
    }


    // Apply selected filters to the selectedItems list and set the active filters
    this.setSelectedItems = function () {
        if (this.selectFilters) {
            var activefilters = [];
            var propnames = [];
            var propvals = [];
            this.selectFilters.forEach(function (fs) {
                if (fs.valueText) {
                    var ftext = fs.valueText();
                    if (ftext) {
                        propnames.push(fs.name);
                        propvals.push(fs.valueArray());
                        activefilters.push(fs);
                    }
                }
            });
            this.selectedItems(this.allItems.loadByProperties(propnames, propvals)());
            this.activeFilters(activefilters);
        }
    }


    // process one select filter if not processed yet
    this.setFilterOptions = function (filter) {
        if (this.processedFilters.indexOf(filter) == -1 && filter.setAvailableOptions) {
            this.processedFilters.push(filter);
            filter.setAvailableOptions();
        }
    }


    // Go through the filter-select objects and update them based on current selections.
    // The processedFilters array ensures that each object is only processed once
    // and prevents re-entry while still processing.
    this.resolveSelections = function () {
        if (this.selectFilters && this.processedFilters.length == 0) {
            for (var i = 0; i < this.selectFilters.length; i++)
            this.setFilterOptions(this.selectFilters[i]);
            this.processedFilters = [];
            this.setSelectedItems();
        }
    }

};

/* ---- End of SelectFilters.js content ---- */


/* ---- index.cshtml script block content ---- */

// Define the filtering select controls this way.
// Parameters to selectFilter() are:
//   name:         name of property to filter on
//   parentName:   name of master select control's property
//   model:        the model object for this view
//   multiselect:  whether to allow selection of multiple values true/false
function loadSelects(model) {
    new selectFilter('Region', '', model, 'Region', false);
    new selectFilter('City', 'Region', model, 'City', false);
    new selectFilter('Park', 'City', model, 'Park', false);
    new selectFilter('Type', 'Park', model, 'Trail Type', false);
    new selectFilter('Accessible', 'Type', model, 'Accessible', true);
}

// One way to load the list of objects to be filtered by this page.
// Another way wuld be with an ajax call, as in the ready() function below.



// We added this simple top-level model to separate the knockout
// viewmodel from the select-filter sub-model.  It's easy to add
// other knockout variables and bindings to this view model if
// needed for other controls on the page.
var viewModel = function() {
    this.selectFilterVM = new sfViewModel(this);
};
var AllItems = [{
    Region: "NORTH",
    City: "Wlmington",
    Park: "Alapocas Run",
    Trail: "Pawpaw Loop",
    Accessible: "Yes",
    Type: "Hiking-Biking",
	location: {lat: 39.772280, lng: -75.565182}
}, {
    Region: "NORTH",
    City: "Wlmington",
    Park: "Alapocas Run",
    Trail: "Alapocas Woods",
    Accessible: "No",
    Type: "Hiking",
    location: {lat: 39.773758, lng: -75.565835}
}, {
    Region: "NORTH",
    City: "Wlmington",
    Park: "Fox Point",
    Trail: "Northern Delaware Greenway",
    Accessible: "Yes",
    Type: "Hiking-Biking",
    location: {lat: 39.770754, lng: -75.557597}
}, {
    Region: "CENTRAL",
    City: "Felton",
    Park: "Killens Pond",
    Trail: "Life Course",
    Accessible: "Yes",
    Type: "Hiking",
    location: {lat: 38.986027, lng: -75.546752}
}, {
    Region: "CENTRAL",
    City: "Felton",
    Park: "Killens Pond",
    Trail: "Pondside",
    Accessible: "No",
    Type: "Hiking",
    location: {lat: 38.983889, lng: -75.537532}
}, {
    Region: "SOUTH",
    City: "Rehoboth Beach",
    Park: "Cape Henlopen",
    Trail: "Junction + Breakwater",
    Accessible: "Yes",
    Type: "Hiking-Biking",
    location: {lat: 38.719980, lng: -75.111376}
}, {
    Region: "SOUTH",
    City: "Rehoboth Beach",
    Park: "Delaware Seashore",
    Trail: "Beach Area",
    Accessible: "No",
    Type: "Hiking-Equestrian",
    location: {lat: 38.648931, lng: -75.067286}
}, {
    Region: "SOUTH",
    City: "Laurel",
    Park: "Trap Pond",
    Trail: "American Holly",
    Accessible: "Yes",
    Type: "Hiking-Biking",
    location: {lat: 38.522926, lng: -75.480642}
}, {
    Region: "SOUTH",
    City: "Fenwick Island",
    Park: "Fenwick Island",
    Trail: "Beach Area",
    Accessible: "No",
    Type: "Hiking-Equestrian",
    location: {lat: 38.475094, lng: -75.049737}
}, {
    Region: "NORTH",
    City: "Newark",
    Park: "White Clay Creek",
    Trail: "Millstone",
    Accessible: "No",
    Type: "Hiking",
    location: {lat: 39.714186, lng: -75.767161}
}, {
    Region: "NORTH",
    City: "Newark",
    Park: "White Clay Creek",
    Trail: "Twin Valley",
    Accessible: "No",
    Type: "Hiking",
    location: {lat: 39.714293, lng: -75.766936}
}, {
    Region: "NORTH",
    City: "Yorklyn",
    Park: "Auburn Heights Preserve",
    Trail: "Trolley Trail",
    Accessible: "No",
    Type: "Hiking-Biking",
    location: {lat: 39.807890, lng: -75.681021}
}];

$(document).ready(function () {
    // specify the method to load the select filters.
    var model = new viewModel();
    model.selectFilterVM.loadSelectsFunc = loadSelects;

    // To load the item list with an ajax call, uncomment this line and comment out the one below it.

    // Load homes collection from server, then populate allItems
    // $.getJSON("/Home/GetHomes", model.selectFilterVM.loadData(model));
	// you can change the URL as needed.

    // To load the items from a local javascript array, uncomment this line and comment out the previous one.
    model.selectFilterVM.loadListFromArray({
        AllItems: AllItems
    });
});

var map;

// Create a new blank array for all the listing markers.
var markers = [];

// This global polygon variable is to ensure only ONE polygon is rendered.
var polygon = null;

// Create placemarkers array to use in multiple functions to have control
// over the number of places that show.
var placeMarkers = [];

function initMap() {
  // Create a styles array to use with the map.
  var styles = [
    {
      featureType: 'water',
      stylers: [
        { color: '#00599C' },
        { "saturation": 50 }
      ]
    },{
      featureType: 'water',
      elementType: 'labels.text.fill',
      stylers: [
        { color: '#92998d' }
      ]
    },{
      featureType: 'administrative',
      elementType: 'geometry.stroke',
      stylers: [
        { color: '#c9b2a6' }
      ]
    },{
      featureType: 'administrative.land_parcel',
      elementType: 'geometry.stroke',
      stylers: [
        { color: '#D6C499' }
      ]
    },{
      featureType: 'administrative.land_parcel',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#ffffff' }]
    },{
      featureType: 'administrative.city',
      elementType: 'geometry.fill',
      stylers: [{ color: '#D6C499' }]
    },{
      featureType: 'landscape.natural',
      elementType: 'geometry',
      stylers: [{ color: '#ffffff' }]
    },{
      featureType: 'poi.park',
      elementType: 'geometry.fill',
      stylers: [{ color: '#5AB947' }]
    },{
      featureType: 'poi.park',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#f98611' }]
    },{
      featureType: 'road',
      elementType: 'geometry',
      stylers: [{ color: '#8B5E3A' }]
    },{
      featureType: 'road.arterial',
      elementType: 'geometry',
      stylers: [{ color: '#8B5E3A' }]
    },{
      featureType: 'road.highway.controlled_access',
      elementType: 'geometry',
      stylers: [{ color: '#8B5E3A' }]
    },{
      featureType: 'road.highway.controlled_access',
      elementType: 'geometry.stroke',
      stylers: [{ color: '#8B5E3A' }]
    },{
      featureType: 'road.local',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#1142a3' }]
    },{
      featureType: 'water',
      elementType: 'geometry.fill',
      stylers: [{ color: '#00599C' }, { "saturation": 50 }]
    },{
      featureType: 'water',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#92998d' }]
    }
  ];

  // Constructor creates a new map - only center and zoom are required.
  map = new google.maps.Map(document.getElementById('map'), {
    center: {lat: 39.158368, lng: -75.520299},
    zoom: 9,
    styles: styles,
    mapTypeControl: false
  });

  // This autocomplete is for use in the search within time entry box.
  var timeAutocomplete = new google.maps.places.Autocomplete(
      document.getElementById('search-within-time-text'));
  // Create a searchbox in order to execute a places search
  var searchBox = new google.maps.places.SearchBox(
      document.getElementById('places-search'));
  // Bias the searchbox to within the bounds of the map.
  searchBox.setBounds(map.getBounds());

  // These are the real estate listings that will be shown to the user.
  // Normally we'd have these in a database instead.

  var largeInfowindow = new google.maps.InfoWindow();

  // Initialize the drawing manager.
  var drawingManager = new google.maps.drawing.DrawingManager({
    drawingMode: google.maps.drawing.OverlayType.POLYGON,
    drawingControl: true,
    drawingControlOptions: {
      position: google.maps.ControlPosition.TOP_LEFT,
      drawingModes: [
        google.maps.drawing.OverlayType.POLYGON
      ]
    }
  });

  // Style the markers a bit. This will be our listing marker icon.
  var defaultIcon = makeMarkerIcon('0091ff');

  // Create a "highlighted location" marker color for when the user
  // mouses over the marker.
  var highlightedIcon = makeMarkerIcon('FFFF24');

  // The following group uses the location array to create an array of markers on initialize.
  for (var i = 0; i < AllItems.length; i++) {
    // Get the position from the location array.
    var position = AllItems[i].location;
    var title = AllItems[i].Trail + " - " + AllItems[i].Park;
    // Create a marker per location, and put into markers array.
    var marker = new google.maps.Marker({
      position: position,
      title: title,
      animation: google.maps.Animation.DROP,
      icon: defaultIcon,
      id: i
    });
    // Push the marker to our array of markers.
    markers.push(marker);
    // Create an onclick event to open the large infowindow at each marker.
    marker.addListener('click', function() {
      populateInfoWindow(this, largeInfowindow);
    });
    // Two event listeners - one for mouseover, one for mouseout,
    // to change the colors back and forth.
    marker.addListener('mouseover', function() {
      this.setIcon(highlightedIcon);
    });
    marker.addListener('mouseout', function() {
      this.setIcon(defaultIcon);
    });
  }
  document.getElementById('show-parks').addEventListener('click', showParks);

  document.getElementById('hide-parks').addEventListener('click', function() {
    hideMarkers(markers);
  });

  document.getElementById('toggle-drawing').addEventListener('click', function() {
    toggleDrawing(drawingManager);
  });

  document.getElementById('search-within-time').addEventListener('click', function() {
    searchWithinTime();
  });

  // Listen for the event fired when the user selects a prediction from the
  // picklist and retrieve more details for that place.
  searchBox.addListener('places_changed', function() {
    searchBoxPlaces(this);
  });

  // Listen for the event fired when the user selects a prediction and clicks
  // "go" more details for that place.
  document.getElementById('go-places').addEventListener('click', textSearchPlaces);

  // Add an event listener so that the polygon is captured,  call the
  // searchWithinPolygon function. This will show the markers in the polygon,
  // and hide any outside of it.
  drawingManager.addListener('overlaycomplete', function(event) {
    // First, check if there is an existing polygon.
    // If there is, get rid of it and remove the markers
    if (polygon) {
      polygon.setMap(null);
      hideMarkers(markers);
    }
    // Switching the drawing mode to the HAND (i.e., no longer drawing).
    drawingManager.setDrawingMode(null);
    // Creating a new editable polygon from the overlay.
    polygon = event.overlay;
    polygon.setEditable(true);
    // Searching within the polygon.
    searchWithinPolygon(polygon);
    // Make sure the search is re-done if the poly is changed.
    polygon.getPath().addListener('set_at', searchWithinPolygon);
    polygon.getPath().addListener('insert_at', searchWithinPolygon);
  });
}

// This function populates the infowindow when the marker is clicked. We'll only allow
// one infowindow which will open at the marker that is clicked, and populate based
// on that markers position.
function populateInfoWindow(marker, infowindow) {
  // Check to make sure the infowindow is not already opened on this marker.
  if (infowindow.marker != marker) {
    // Clear the infowindow content to give the streetview time to load.
    infowindow.setContent('');
    infowindow.marker = marker;
    // Make sure the marker property is cleared if the infowindow is closed.
    infowindow.addListener('closeclick', function() {
      infowindow.marker = null;
    });
    var streetViewService = new google.maps.StreetViewService();
    var radius = 50;
    // In case the status is OK, which means the pano was found, compute the
    // position of the streetview image, then calculate the heading, then get a
    // panorama from that and set the options
    function getStreetView(data, status) {
      if (status == google.maps.StreetViewStatus.OK) {
        var nearStreetViewLocation = data.location.latLng;
        var heading = google.maps.geometry.spherical.computeHeading(
          nearStreetViewLocation, marker.position);
          infowindow.setContent('<div>' + marker.title + '</div><div id="pano"></div>');
          var panoramaOptions = {
            position: nearStreetViewLocation,
            pov: {
              heading: heading,
              pitch: 10
            }
          };
        var panorama = new google.maps.StreetViewPanorama(
          document.getElementById('pano'), panoramaOptions);
      } else {
        infowindow.setContent('<div>' + marker.title + '</div>' +
          '<div>No Street View Found</div>');
      }
    }
    // Use streetview service to get the closest streetview image within
    // 50 meters of the markers position
    streetViewService.getPanoramaByLocation(marker.position, radius, getStreetView);
    // Open the infowindow on the correct marker.
    infowindow.open(map, marker);
  }
}

// This function will loop through the markers array and display them all.
function showParks() {
  var bounds = new google.maps.LatLngBounds();
  // Extend the boundaries of the map for each marker and display the marker
  for (var i = 0; i < markers.length; i++) {
    markers[i].setMap(map);
    bounds.extend(markers[i].position);
  }
  map.fitBounds(bounds);
}

// This function will loop through the listings and hide them all.
function hideMarkers(markers) {
  for (var i = 0; i < markers.length; i++) {
    markers[i].setMap(null);
  }
}

// This function takes in a COLOR, and then creates a new marker
// icon of that color. The icon will be 21 px wide by 34 high, have an origin
// of 0, 0 and be anchored at 10, 34).
function makeMarkerIcon(markerColor) {
  var markerImage = new google.maps.MarkerImage(
    'http://chart.googleapis.com/chart?chst=d_map_spin&chld=1.15|0|'+ markerColor +
    '|40|_|%00%59%9C',
    new google.maps.Size(21, 34),
    new google.maps.Point(0, 0),
    new google.maps.Point(10, 34),
    new google.maps.Size(21,34));
  return markerImage;
}

// This shows and hides (respectively) the drawing options.
function toggleDrawing(drawingManager) {
  if (drawingManager.map) {
    drawingManager.setMap(null);
    // In case the user drew anything, get rid of the polygon
    if (polygon !== null) {
      polygon.setMap(null);
    }
  } else {
    drawingManager.setMap(map);
  }
}

// This function hides all markers outside the polygon,
// and shows only the ones within it. This is so that the
// user can specify an exact area of search.
function searchWithinPolygon() {
  for (var i = 0; i < markers.length; i++) {
    if (google.maps.geometry.poly.containsLocation(markers[i].position, polygon)) {
      markers[i].setMap(map);
    } else {
      markers[i].setMap(null);
    }
  }
}

// This function allows the user to input a desired travel time, in
// minutes, and a travel mode, and a location - and only show the listings
// that are within that travel time (via that travel mode) of the location
function searchWithinTime() {
  // Initialize the distance matrix service.
  var distanceMatrixService = new google.maps.DistanceMatrixService;
  var address = document.getElementById('search-within-time-text').value;
  // Check to make sure the place entered isn't blank.
  if (address == '') {
    window.alert('You must enter an address.');
  } else {
    hideMarkers(markers);
    // Use the distance matrix service to calculate the duration of the
    // routes between all our markers, and the destination address entered
    // by the user. Then put all the origins into an origin matrix.
    var origins = [];
    for (var i = 0; i < markers.length; i++) {
      origins[i] = markers[i].position;
    }
    var destination = address;
    var mode = document.getElementById('mode').value;
    // Now that both the origins and destination are defined, get all the
    // info for the distances between them.
    distanceMatrixService.getDistanceMatrix({
      origins: origins,
      destinations: [destination],
      travelMode: google.maps.TravelMode[mode],
      unitSystem: google.maps.UnitSystem.IMPERIAL,
    }, function(response, status) {
      if (status !== google.maps.DistanceMatrixStatus.OK) {
        window.alert('Error was: ' + status);
      } else {
        displayMarkersWithinTime(response);
      }
    });
  }
}

// This function will go through each of the results, and,
// if the distance is LESS than the value in the picker, show it on the map.
function displayMarkersWithinTime(response) {
  var maxDuration = document.getElementById('max-duration').value;
  var origins = response.originAddresses;
  var destinations = response.destinationAddresses;
  // Parse through the results, and get the distance and duration of each.
  // Because there might be  multiple origins and destinations we have a nested loop
  // Then, make sure at least 1 result was found.
  var atLeastOne = false;
  for (var i = 0; i < origins.length; i++) {
    var results = response.rows[i].elements;
    for (var j = 0; j < results.length; j++) {
      var element = results[j];
      if (element.status === "OK") {
        // The distance is returned in feet, but the TEXT is in miles. If we wanted to switch
        // the function to show markers within a user-entered DISTANCE, we would need the
        // value for distance, but for now we only need the text.
        var distanceText = element.distance.text;
        // Duration value is given in seconds so we make it MINUTES. We need both the value
        // and the text.
        var duration = element.duration.value / 60;
        var durationText = element.duration.text;
        if (duration <= maxDuration) {
          //the origin [i] should = the markers[i]
          markers[i].setMap(map);
          atLeastOne = true;
          // Create a mini infowindow to open immediately and contain the
          // distance and duration
          var infowindow = new google.maps.InfoWindow({
            content: durationText + ' away, ' + distanceText +
              '<div><input type=\"button\" value=\"View Route\" onclick =' +
              '\"displayDirections(&quot;' + origins[i] + '&quot;);\"></input></div>'
          });
          infowindow.open(map, markers[i]);
          // Put this in so that this small window closes if the user clicks
          // the marker, when the big infowindow opens
          markers[i].infowindow = infowindow;
          google.maps.event.addListener(markers[i], 'click', function() {
            this.infowindow.close();
          });
        }
      }
    }
  }
  if (!atLeastOne) {
    window.alert('We could not find any locations within that distance!');
  }
}

// This function is in response to the user selecting "show route" on one
// of the markers within the calculated distance. This will display the route
// on the map.
function displayDirections(origin) {
  hideMarkers(markers);
  var directionsService = new google.maps.DirectionsService;
  // Get the destination address from the user entered value.
  var destinationAddress =
      document.getElementById('search-within-time-text').value;
  // Get mode again from the user entered value.
  var mode = document.getElementById('mode').value;
  directionsService.route({
    // The origin is the passed in marker's position.
    origin: origin,
    // The destination is user entered address.
    destination: destinationAddress,
    travelMode: google.maps.TravelMode[mode]
  }, function(response, status) {
    if (status === google.maps.DirectionsStatus.OK) {
      var directionsDisplay = new google.maps.DirectionsRenderer({
        map: map,
        directions: response,
        draggable: true,
        polylineOptions: {
          strokeColor: 'green'
        }
      });
    } else {
      window.alert('Directions request failed due to ' + status);
    }
  });
}

// This function fires when the user selects a searchbox picklist item.
// It will do a nearby search using the selected query string or place.
function searchBoxPlaces(searchBox) {
  hideMarkers(placeMarkers);
  var places = searchBox.getPlaces();
  if (places.length == 0) {
    window.alert('We did not find any places matching that search!');
  } else {
  // For each place, get the icon, name and location.
    createMarkersForPlaces(places);
  }
}

// This function firest when the user select "go" on the places search.
// It will do a nearby search using the entered query string or place.
function textSearchPlaces() {
  var bounds = map.getBounds();
  hideMarkers(placeMarkers);
  var placesService = new google.maps.places.PlacesService(map);
  placesService.textSearch({
    query: document.getElementById('places-search').value,
    bounds: bounds
  }, function(results, status) {
    if (status === google.maps.places.PlacesServiceStatus.OK) {
      createMarkersForPlaces(results);
    }
  });
}

// This function creates markers for each place found in either places search.
function createMarkersForPlaces(places) {
  var bounds = new google.maps.LatLngBounds();
  for (var i = 0; i < places.length; i++) {
    var place = places[i];
    var icon = {
      url: place.icon,
      size: new google.maps.Size(35, 35),
      origin: new google.maps.Point(0, 0),
      anchor: new google.maps.Point(15, 34),
      scaledSize: new google.maps.Size(25, 25)
    };
    // Create a marker for each place.
    var marker = new google.maps.Marker({
      map: map,
      icon: icon,
      title: place.name,
      position: place.geometry.location,
      id: place.place_id
    });
    // Create a single infowindow to be used with the place details information
    // so that only one is open at once.
    var placeInfoWindow = new google.maps.InfoWindow();
    // If a marker is clicked, do a place details search on it in the next function.
    marker.addListener('click', function() {
      if (placeInfoWindow.marker == this) {
        console.log("This infowindow already is on this marker!");
      } else {
        getPlacesDetails(this, placeInfoWindow);
      }
    });
    placeMarkers.push(marker);
    if (place.geometry.viewport) {
      // Only geocodes have viewport.
      bounds.union(place.geometry.viewport);
    } else {
      bounds.extend(place.geometry.location);
    }
  }
  map.fitBounds(bounds);
}

// This is the PLACE DETAILS search - it's the most detailed so it's only
// executed when a marker is selected, indicating the user wants more
// details about that place.
function getPlacesDetails(marker, infowindow) {
var service = new google.maps.places.PlacesService(map);
service.getDetails({
  placeId: marker.id
}, function(place, status) {
  if (status === google.maps.places.PlacesServiceStatus.OK) {
    // Set the marker property on this infowindow so it isn't created again.
    infowindow.marker = marker;
    var innerHTML = '<div>';
    if (place.name) {
      innerHTML += '<strong>' + place.name + '</strong>';
    }
    if (place.formatted_address) {
      innerHTML += '<br>' + place.formatted_address;
    }
    if (place.formatted_phone_number) {
      innerHTML += '<br>' + place.formatted_phone_number;
    }
    if (place.opening_hours) {
      innerHTML += '<br><br><strong>Hours:</strong><br>' +
          place.opening_hours.weekday_text[0] + '<br>' +
          place.opening_hours.weekday_text[1] + '<br>' +
          place.opening_hours.weekday_text[2] + '<br>' +
          place.opening_hours.weekday_text[3] + '<br>' +
          place.opening_hours.weekday_text[4] + '<br>' +
          place.opening_hours.weekday_text[5] + '<br>' +
          place.opening_hours.weekday_text[6];
    }
    if (place.photos) {
      innerHTML += '<br><br><img src="' + place.photos[0].getUrl(
          {maxHeight: 100, maxWidth: 200}) + '">';
    }
    innerHTML += '</div>';
    infowindow.setContent(innerHTML);
    infowindow.open(map, marker);
    // Make sure the marker property is cleared if the infowindow is closed.
    infowindow.addListener('closeclick', function() {
      infowindow.marker = null;
    });
  }
});
}
