sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment",
    "sap/m/UploadCollectionParameter",
    "sap/m/PDFViewer",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/format/DateFormat"
], (Controller, Fragment, UploadCollectionParameter, PDFViewer, JSONModel, MessageToast, MessageBox, DateFormat) => {
    "use strict";

    var tipoUpload = "";
    var baulAnexos = { pdf: [], png: [], jpeg: [], msword: [], trash: [] };
    var anexosBLOB = {};
    var urlImage = "";
    var dPersL = "";
    var dIdL = "";

    var oODataJSONModel = new JSONModel();

    return Controller.extend("facturasenrevisionfront.controller.main", {
        onInit() {
            this._pdfViewer = new PDFViewer();
            this.getView().addDependent(this._pdfViewer);

            //Sincronización automática.
            this._runAutoSync();

            this.getView().addEventDelegate({
                onBeforeShow: function () {
                    this.getFacturasenRevision();
                }
            }, this);
        },

        // === NUEVO: Ejecutar sincronización en background ===
        _runAutoSync: function () {
            console.log('[UI] Iniciando sincronización automática en background...');

            // Fire-and-forget: no bloqueamos la UI ni esperamos respuesta
            fetch("/odata/v4/pre-invoice/syncXMLPortWithSAP", {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                credentials: "include"
            })
                .then(response => response.json())
                .then(data => {
                    console.log('[UI] Sincronización automática completada:', data);
                    const result = data.result || {};

                    // Notificación sutil solo si hubo cambios
                    if (result.updated > 0 || result.deleted > 0) {
                        MessageToast.show(
                            ` Sincronización: ${result.updated} actualizadas, ${result.deleted} eliminadas`,
                            { duration: 5000 }
                        );
                    }

                    // Refrescar lista de facturas después de sincronizar
                    this.getFacturasenRevision();
                })
                .catch(error => {
                    console.warn('[UI] Error en sincronización automática (no crítico):', error.message);
                    // No mostramos error al usuario para no interrumpir la experiencia
                    this.getFacturasenRevision();
                });
        },

        ////////////////////// FETCH FACTURAS
        getFacturasenRevision: function () {
            fetch("/odata/v4/pre-invoice/Invoice", {
                method: "GET",
                headers: { "Accept": "application/json" },
                credentials: "include"
            })
                .then(response => {
                    if (!response.ok) {
                        return response.text().then(errText => {
                            throw new Error(`HTTP ${response.status} - ${errText}`);
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    console.log("Respuesta API facturas:", data);
                    oODataJSONModel.setData(data.value || []);
                    this.getOwnerComponent().setModel(oODataJSONModel, "facturas");
                })
                .catch(error => console.error("Error:", error));
        },

        ////////////////////// FORMATO DE FECHAS
        formatODataDate: function (v) {
            if (!v) return "";
            let timestamp;
            const match = /\/Date\((\d+)\)\//.exec(v);
            if (match) {
                timestamp = parseInt(match[1], 10);
            } else {
                const parsed = Date.parse(v);
                if (isNaN(parsed)) return "";
                timestamp = parsed;
            }
            const date = new Date(timestamp);
            const oDateFormat = DateFormat.getDateInstance({ pattern: "dd-MM-yyyy" });
            return oDateFormat.format(date);
        },

        formatDate: function (v) {
            if (v) {
                const oDateFormat = DateFormat.getDateInstance({ pattern: "dd-MM-yyyy" });
                return oDateFormat.format(new Date(v));
            } else {
                return null;
            }
        },

        formatDateSimple: function (v) {
            if (!v) return "";

            let date;
            const match = /\/Date\((\d+)\)\//.exec(v);
            if (match) {
                date = new Date(parseInt(match[1], 10));
            } else {
                date = new Date(v);
            }

            if (isNaN(date.getTime())) return "";

            const oDateFormat = DateFormat.getDateInstance({ pattern: "d MMM yyyy" });
            return oDateFormat.format(date);
        },

        providersSearch: function (evt) {
            var filterCustomer = [];
            var query = evt.getParameter("query");
            var obFiltro = this.getView().byId("selectFilterMPed");
            var opFiltro = obFiltro.getSelectedKey();
            if (query && query.length > 0) {
                var filter = new sap.ui.model.Filter(opFiltro, sap.ui.model.FilterOperator.Contains, query);
                filterCustomer.push(filter);
            }
            var list = this.getView().byId("documentList");
            var binding = list.getBinding("items");
            binding.filter(filterCustomer);
        },

        ////////////////////// UPLOAD BUTTONS
        aclaracionButton: function () {
            tipoUpload = "A";
            this.openUploadDialog(tipoUpload);
        },

        uploadButton: function () {
            tipoUpload = "F";
            this.openUploadDialog(tipoUpload);
        },

        openUploadDialog: function (tipoUploadIn) {
            switch (tipoUploadIn) {
                case "A":
                    if (!this._uploadDialog1) {
                        this._uploadDialog1 = sap.ui.xmlfragment(tipoUpload, "facturasenrevisionfront.fragments.UploadAclaracion", this);
                        this.getView().addDependent(this._uploadDialog1);
                    }
                    this._uploadDialog1.open();
                    sap.ui.getCore().getControl(tipoUploadIn + "--idCto").setText(" (" + dIdL + ")  ");
                    sap.ui.getCore().getControl(tipoUploadIn + "--persCto").setText(dPersL);
                    break;
                case "F":
                    if (!this._uploadDialog2) {
                        this._uploadDialog2 = sap.ui.xmlfragment(tipoUpload, "facturasenrevisionfront.fragments.UploadInvoice", this);
                        this.getView().addDependent(this._uploadDialog2);
                    }
                    this._uploadDialog2.open();
                    break;
            }
        },

        ////////////////////// ONCHANGE UPLOAD
        onChange: function (oEvent) {
            var fileList = oEvent.getParameter("files");
            sap.ui.core.Fragment.byId(tipoUpload, "UploadCollection").setBusy(true);
            var bContinue = true;

            if (tipoUpload === "A") {
                if (fileList.length === 0) {
                    MessageBox.information("Se debe seleccionar al menos un archivo por carga");
                    bContinue = false;
                }
                var uploadFilesAcla = { pdf: [], png: [], jpeg: [], msword: [], trash: [] };
                if (bContinue) {
                    for (var i = 0; i < fileList.length; i++) {
                        switch (fileList[i].type) {
                            case "application/msword": uploadFilesAcla.msword.push(fileList[i]); baulAnexos.msword.push(fileList[i]); break;
                            case "image/jpeg": uploadFilesAcla.jpeg.push(fileList[i]); baulAnexos.jpeg.push(fileList[i]); break;
                            case "image/png": uploadFilesAcla.png.push(fileList[i]); baulAnexos.png.push(fileList[i]); break;
                            case "application/pdf": uploadFilesAcla.pdf.push(fileList[i]); baulAnexos.pdf.push(fileList[i]); break;
                            default: uploadFilesAcla.trash.push(fileList[i]); baulAnexos.trash.push(fileList[i]); break;
                        }
                    }
                    this.readCfdi(uploadFilesAcla);
                } else sap.ui.core.Fragment.byId(tipoUpload, "UploadCollection").setBusy(false);
            }

            if (tipoUpload === "F") {
                if (fileList.length !== 2) {
                    MessageBox.information("Se debe seleccionar un máximo de dos archivos por carga.");
                    bContinue = false;
                }
                var uploadFiles = { xml: [], pdf: [] };
                if (bContinue) {
                    for (i = 0; i < fileList.length; i++) {
                        if (fileList[i].type === "text/xml") uploadFiles.xml.push(fileList[i]);
                        if (fileList[i].type === "application/pdf") uploadFiles.pdf.push(fileList[i]);
                    }
                    if (uploadFiles.xml.length !== 1 || uploadFiles.pdf.length !== 1) {
                        MessageBox.information("Seleccione sólo un archivo XML y un PDF para continuar.");
                    } else this.readCfdi(uploadFiles);
                } else sap.ui.core.Fragment.byId(tipoUpload, "UploadCollection").setBusy(false);
            }
        },

        ////////////////////// LEER CFDI / ARCHIVOS
        readCfdi: function (upFiles) {
            // Convertimos archivos a base64 o blob para enviarlos al backend
            anexosBLOB = {};
            if (upFiles.pdf) upFiles.pdf.forEach(f => anexosBLOB[f.name] = f);
            if (upFiles.xml) upFiles.xml.forEach(f => anexosBLOB[f.name] = f);
            if (upFiles.jpeg) upFiles.jpeg.forEach(f => anexosBLOB[f.name] = f);
            if (upFiles.png) upFiles.png.forEach(f => anexosBLOB[f.name] = f);
            if (upFiles.msword) upFiles.msword.forEach(f => anexosBLOB[f.name] = f);

            sap.ui.core.Fragment.byId(tipoUpload, "UploadCollection").setBusy(false);
            MessageToast.show("Archivos listos para enviar");
        },

        ////////////////////// ENVÍO ACLARACIÓN
        onSubmitAcla: function () {
            var mensaje = sap.ui.getCore().getControl(tipoUpload + "--cmntAnexo").getValue();
            if (!mensaje) {
                MessageBox.error("Es obligatorio introducir un mensaje de aclaración.");
                return;
            }
            // Aquí enviar al backend los archivos tipo A con el mensaje
            console.log("Enviando aclaración con archivos:", anexosBLOB, "y mensaje:", mensaje);
            // MessageToast.show("Aclaración enviada correctamente");
            this.onCloseDialogUpload();
        },

        ////////////////////// ENVÍO FACTURA
        sendFact: function () {
            // Similar a aclaración pero para archivos tipo F
            console.log("Enviando factura con archivos:", anexosBLOB);
            MessageToast.show("Factura enviada correctamente");
            this.onCloseDialogUpload();
        },

        ////////////////////// ELIMINAR FACTURA
        delFact: function () {
            sap.ui.getCore().setModel(null, "deliverTable");
            var uploadCollection = sap.ui.core.Fragment.byId(tipoUpload, "UploadCollection");
            var factList = sap.ui.core.Fragment.byId(tipoUpload, "factList");
            var closeDialog = sap.ui.core.Fragment.byId(tipoUpload, "closeDialog");
            uploadCollection.setVisible(true);
            factList.setVisible(false);
            closeDialog.setVisible(true);
        },

        ////////////////////// VER PDF
        pdfView: function (oEvent) {
            var pdfView = oEvent.getSource().getBindingContext("deliverTable").getProperty("/blob");
            var _pdfurl = URL.createObjectURL(pdfView);
            if (!this._PDFViewer) {
                this._PDFViewer = new PDFViewer({ width: "auto", source: _pdfurl });
                jQuery.sap.addUrlWhitelist("blob");
            }
            this._PDFViewer.open();
        },

        ////////////////////// FRAGMENT DOC DETAIL
        handlePressDocument: function (oEvent) {
            if (!this._oDialog) {
                this._oDialog = sap.ui.xmlfragment("docDialogs", "facturasenrevisionfront.fragments.DocDetail", this);
            }
            this.getView().addDependent(this._oDialog);
            this._oDialog.open();
        },

        ////////////////////// CERRAR DIALOG
        onCloseDialogUpload: function () {
            if (this._uploadDialog1) this._uploadDialog1.close();
            if (this._uploadDialog2) this._uploadDialog2.close();
        }

    });
});
