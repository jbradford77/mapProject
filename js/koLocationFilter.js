/* ---- SelectFilters.js content ---- */

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
