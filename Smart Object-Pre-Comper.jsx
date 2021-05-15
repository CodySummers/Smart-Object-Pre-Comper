//TO DO
//fix expressions doesn't work without deleting the layer
//test embedded AI files.

//DONE
//AE folder and pre-comp in folder
//error msg if no layers are a smart object
//focus back to AE
//relink parents
//children not re-parenting correctly 

//UI
var panelGlobal = this;
var palette = (function () {

    var SmartObjectPreComper = (panelGlobal instanceof Panel) ? panelGlobal : new Window("palette");
    if (!(panelGlobal instanceof Panel)) SmartObjectPreComper.text = "Smart Object Pre-Comper";
    SmartObjectPreComper.orientation = "column";

    SmartObjectPreComper.alignChildren = ["center", "top"];
    SmartObjectPreComper.spacing = 10;
    SmartObjectPreComper.margins = 16;

    var runButton = SmartObjectPreComper.add("button", undefined, undefined, { name: "runButton" });
    runButton.helpTip = "Currently only supports your active composition\nand it's pre-comps";
    runButton.text = "Pre-Comp Smart Objects";
    runButton.onClick = function () {
        checkSelectedLayers();
    }

    var divider = SmartObjectPreComper.add("panel", undefined, undefined, { name: "divider" });
    divider.alignment = "fill";

    /*
    var FixRotation = SmartObjectPreComper.add("checkbox", undefined, undefined, {name: "FixRotation"}); 
        FixRotation.helpTip = "If the layer has been rotated in photoshop.\nAfter Effects tries to correct it.\n(This doesn't always fully work due to how PS stores\nSmart Object transformations)"; 
        FixRotation.text = "Fix Rotation"; 
        FixRotation.alignment = ["left","top"]; 
    */

    var PhotoshopOpen = SmartObjectPreComper.add("checkbox", undefined, undefined, { name: "PhotoshopOpen" });
    PhotoshopOpen.helpTip = "This script needs Photoshop to run\nif it's not currently running it will open and\nclose again when finished unless checked.";
    PhotoshopOpen.text = "Keep Photoshop Open";
    PhotoshopOpen.alignment = ["left", "top"];
    PhotoshopOpen.value = true;

    SmartObjectPreComper.layout.layout(true);
    SmartObjectPreComper.layout.resize();

    SmartObjectPreComper.onResizing = SmartObjectPreComper.onResize = function () { this.layout.resize(); }

    if (SmartObjectPreComper instanceof Window) SmartObjectPreComper.show();

    function checkSelectedLayers() {

        var activeComp = app.project.activeItem

        var selectedLayers = activeComp.selectedLayers;
        var layers = [];
        var selectedLayer = [];

        if (activeComp == null || !(activeComp instanceof CompItem)) {
            alert("Please select a composition");
            return false;
        }

        if (selectedLayers.length > 0) {
            layers = selectedLayers;
        } else {
            allLayers(activeComp);
        }

        function allLayers(collectLayers) {

            for (var i = 1; i <= collectLayers.layers.length; i++) {
                if (collectLayers.layers[i].source != null) {
                    if (collectLayers.layers[i].source.typeName == "Composition") {
                        allLayers(collectLayers.layers[i].source);
                    } else layers.push(collectLayers.layers[i])
                }
            }
        }

        for (i = 0; i < layers.length; i++) {
            if (layers[i].source != null) {
                if (layers[i].source.typeName == "Footage") {
                    var fileExtension = layers[i].source.file.name.split('.')

                    if (fileExtension[fileExtension.length - 1] == "psd" || fileExtension[fileExtension.length - 1] == "psb") {
                        selectedLayer.push(layers[i]);

                    }
                }

            }
        }

        if (selectedLayer.length == 0) {
            alert("No Smart Object layers found")
            return false;
        }

        main(activeComp, selectedLayer)
    }

    function main(activeComp, selectedLayer) {

        //Global Variables 
        var items = app.project.items;
        var soFolderExists = makeFolder();
        var atLeastOneLayerFound = false;
        var newFolder;
        var newLayer;
        var psdFile = selectedLayer[0].source.mainSource.file;
        var soLayers = [];
        var fileOpen = PhotoshopOpen.value;
        var mainCompDuration = activeComp.duration;
        var mainCompFrameRate = activeComp.frameRate;
        //Initiate bridetalk and run photoshop
        var psRunning = PhotoshopOpen.value;
        var bt = new BridgeTalk();
        var specifer = BridgeTalk.getSpecifier("photoshop");
        if (specifer == null) alert("Photoshop not found, this script needs photoshop to run");
        if (!BridgeTalk.isRunning(specifer)) {
            BridgeTalk.launch(specifer);
            psRunning = (psRunning == true) ? true : false;
        } else psRunning = true;


        var openFile = '\
            docs =  app.documents;\
            var fileOpen = ('+ fileOpen + ' == true) ? true : false;\
            psdFile = File("' + psdFile.fsName + '");\
            psdFileName = "'+ psdFile.displayName + '";\
            \
            //is the file already open (Not used atm)\
                        var fileOpen = ("+fileOpen+" == true) ? true : false;\
                        for(i = 0; i < docs.length; i++){\
                                if(docs[i].name == psdFileName){\
                                        fileOpen = true;\
                                    }\
                            }\
           open(psdFile)\
           fileOpen;\
        '


        //Run bridgetalk
        bt.target = specifer;
        bt.body = openFile;
        bt.onResult = function (msg) {
            fileOpen = msg.body;
            for (var i = 0; i < selectedLayer.length; i++)
                searchLayers(i);
        }
        bt.send();

        function searchLayers(layerCount) {

            var psLayers = '\
      var myDocument = app.activeDocument;\
       var selectedLayer = "'+ selectedLayer[layerCount].source.name.split("/")[0] + '";\
       var layerFound = false;\
       findLayer(myDocument)\
\
function findLayer(parentLayer){\
    \
        for(var i = 0; i < parentLayer.layers.length; i++){\
            if(parentLayer.layers[i].name == selectedLayer && parentLayer.layers[i].kind == LayerKind.SMARTOBJECT){\
                layerFound = true;\
                 saveLayer(parentLayer.layers[i]);\
                 break;\
                }else if(parentLayer.layers[i].typename == "LayerSet") {\
                    findLayer(parentLayer.layers[i]);\
        }\
    }\
}\
\
function saveLayer(soLayer){\
    var saveFile = File(activeDocument.path.fsName + "/Smart Layers/" + soLayer.name + ".psd");\
    if(!saveFile.parent.exists){\
            saveFile.parent.create()\
        }\
    myDocument.activeLayer = soLayer;\
    app.runMenuItem(stringIDToTypeID("placedLayerEditContents"));\
     psdSaveOptions = new PhotoshopSaveOptions();\
                                        psdSaveOptions.embedColorProfile = true;\
                                        psdSaveOptions.alphaChannels = true;\
                                        psdSaveOptions.layers = true;\
                                        app.activeDocument.saveAs(saveFile, psdSaveOptions, true, Extension.LOWERCASE);\
     app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);\
    }\
       msg = [layerFound, '+ layerCount + ', selectedLayer];\
       msg.toSource();\
      '

            bt.body = psLayers;

            bt.send()
            bt.onResult = function (msg) {

                var layerFound = eval(msg.body)[0];
                var layerCount = eval(msg.body)[1];
                var layerName = eval(msg.body)[2];
                atLeastOneLayerFound = (atLeastOneLayerFound == true) ? true : layerFound;
                if (layerFound == true) {
                    changeLayer(layerCount, layerName);
                }
                if (layerCount + 1 == selectedLayer.length) {
                    if (atLeastOneLayerFound == false) {
                        alert("No Smart Object Found")
                        app.activate();
                    } else app.activate();
                    if (psRunning == false) {
                        closePS()
                    }
                }
            }
        }

        function changeLayer(layerCount, layerName) {

            app.beginUndoGroup("Smart Object Import")

            var newFile = new ImportOptions(File(selectedLayer[layerCount].source.mainSource.file.parent.toString() + "/Smart Layers/" + layerName + ".psd"));

            if (newFile.canImportAs(ImportAsType.COMP_CROPPED_LAYERS)) {
                newFile.importAs = ImportAsType.COMP_CROPPED_LAYERS;
                newLayer = app.project.importFile(newFile);
                putInFolder();


            }

            changeDuration(newLayer);

            function changeDuration(compToChange) {
                compToChange.duration = mainCompDuration;
                compToChange.frameRate = mainCompFrameRate;
                for (var i = 1; i <= compToChange.layers.length; i++) {
                    compToChange.layers[i].outPoint = mainCompDuration;
                    if (compToChange.layers[i].source.typeName == "Composition") {
                        changeDuration(compToChange.layers[i].source);
                    }
                }
            }

            var replaceLayer = selectedLayer[layerCount].duplicate();
            selectedLayer[layerCount].enabled = false;

            //Fix Scaling if pre-comp bigger/smaller than layer

            var newScaleX;
            var newScaleY;

            if (replaceLayer.scale.numKeys > 0) {
                for (i = 1; i <= replaceLayer.scale.numKeys; i++) {
                    newScaleX = (selectedLayer[layerCount].width / newLayer.width * 100) * (replaceLayer.scale.keyValue(i)[0] / 100);
                    newScaleY = (selectedLayer[layerCount].height / newLayer.height * 100) * (replaceLayer.scale.keyValue(i)[1] / 100);
                    replaceLayer.scale.setValueAtKey(i, [newScaleX, newScaleX]);
                }
            } else {
                newScaleX = (selectedLayer[layerCount].width / newLayer.width * 100) * (replaceLayer.scale.value[0] / 100);
                newScaleY = (selectedLayer[layerCount].height / newLayer.height * 100) * (replaceLayer.scale.value[1] / 100);
                replaceLayer.scale.setValue([newScaleX, newScaleX]);
            }
            replaceLayer.name = selectedLayer[layerCount].name + "  (Smart Object)";
            replaceLayer.label = 15;
            replaceLayer.replaceSource(newLayer, false);
            findChildren();

            //app.project.autoFixExpressions();


            function findChildren() {
                var parentComp = replaceLayer.containingComp;
                for (i = 1; i <= parentComp.layers.length; i++) {
                    if (parentComp.layers[i].parent == selectedLayer[layerCount]) {
                        //parentComp.layers[i].setParentWithJump(replaceLayer);
                        parentComp.layers[i].parent = replaceLayer;
                    }
                }
            }

            app.endUndoGroup();

        }

        function makeFolder() {
            var folderExists = false;
            for (i = 1; i <= items.length; i++) {
                if (items[i].name == "Smart Objects" && items[i].typeName == "Folder") {
                    newFolder = items[i];
                    return true;
                }
            }
            newFolder = items.addFolder("Smart Objects");
            return false;
        }

        function putInFolder() {
            newLayer.parentFolder = newFolder;
            for (i = 1; i <= items.length; i++) {
                if (items[i].name == (newLayer.name + " Layers") && items[i].typeName == "Folder") {
                    items[i].parentFolder = newFolder;
                    break;
                }
            }
        }

        function closePS() {

            var psClose = '\
        app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);\
        photoshop.quit();\
        '

            bt.body = psClose;
            bt.send()
        }

    }

}());