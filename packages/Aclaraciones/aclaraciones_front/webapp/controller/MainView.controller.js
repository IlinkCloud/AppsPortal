sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/odata/v4/ODataModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "aclaracionesfront/model/formatter"
], (Controller, JSONModel, ODataModel, Filter, FilterOperator, MessageToast, formatter) => {
    "use strict";

    return Controller.extend("aclaracionesfront.controller.MainView", {
        onInit: function () {
            this.getView().setModel(new JSONModel(), "obtenAcla");
            this._oAclaModel = new ODataModel({
                serviceUrl: "/odata/v4/aclaraciones/",
                synchronizationMode: "None"
            });
            this._oNotifiModel = new ODataModel({
                serviceUrl: "/odata/v4/notification/",
                synchronizationMode: "None"
            });
            //this.getBusinessPartner();
            this.getAclaraciones();

            // Documentos adjuntos
            const oSystemDocumentsModel = new ODataModel({
                serviceUrl: "/odata/v4/system-documents/",
                synchronizationMode: "None",
                operationMode: "Server"
            });

            this.getView().setModel(oSystemDocumentsModel, "systemDocuments");

            this._oDocumentsMenu = new sap.m.Menu();
            this.byId("btnPortalDocuments").setMenu(this._oDocumentsMenu);
            this._loadDocumentsMenu();
        },

        async getAclaraciones() {
            try {
                sap.ui.core.BusyIndicator.show(0);
                const oAction = this._oAclaModel.bindContext("/GetAclaracionesFromDB(...)");
                await oAction.execute();
                const aResults = oAction.getBoundContext().getObject();
                console.log(aResults);
                this.getView().getModel("obtenAcla").setData({
                    results: aResults.value || aResults || []
                });
            } catch (error) {
                console.error(error);
                sap.m.MessageBox.error("Error al obtener aclaraciones");
            } finally {
                sap.ui.core.BusyIndicator.hide();
            }
        },






        formatDate: function (sValue) {
            if (!sValue) return "";
            try {
                const oDate = new Date(sValue);
                return oDate.toLocaleDateString("es-MX", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit"
                });
            } catch (e) {
                console.error("[formatDate] Error formateando fecha:", e);
                return sValue;
            }
        },
        formatLocalDate: function (sValue) {
            if (!sValue) {
                return "";
            }

            const [year, month, day] = sValue.split("-");

            const oDate = new Date(
                Number(year),
                Number(month) - 1,
                Number(day)
            );

            return oDate.toLocaleDateString("es-MX", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            });
        },
        formatDocumentType: function (sType) {
            const oBundle = this.getOwnerComponent()
                .getModel("i18n")
                .getResourceBundle();

            const sKey = `clarifications.${sType}`;

            try {
                return oBundle.getText(sKey);
            } catch (e) {
                return sType;
            }
        },
        formatStatusText: function (sStatus) {
            const oBundle = this.getOwnerComponent()
                .getModel("i18n")
                .getResourceBundle();
            const sKey = `clarifications.${sStatus}`;

            try {
                return oBundle.getText(sKey);
            } catch (e) {
                return sType;
            }
        },
        formatStatusState: function (sStatus) {
            return sStatus === "C" ? "Success" : "Warning";
        },
        _getAvailableDocuments: async function () {
            const oModel = this.getView().getModel("systemDocuments");
            const oOperation = oModel.bindContext("/GetSystemDocuments(...)");

            await oOperation.execute();

            const aDocuments = oOperation.getBoundContext().getObject().value ?? [];
            return aDocuments.filter(doc => !!doc.FileName);
        },
        _buildDocumentsMenu: function (aDocuments) {
            this._oDocumentsMenu.destroyItems();
            aDocuments.forEach(doc => {
                this._oDocumentsMenu.addItem(
                    new sap.m.MenuItem({
                        text: doc.DocumentName,
                        icon: this._getDocumentIcon(doc.DocumentType),
                        press: () => this._viewDocument(doc)
                    })
                );
            });
        },
        _getDocumentIcon: function (documentType) {
            switch (documentType) {
                case "HELP_MANUAL":
                    return "sap-icon://education";
                case "PRIVACY_NOTICE":
                    return "sap-icon://shield";
                default:
                    return "sap-icon://document";
            }
        },
        _viewDocument: async function (oDocument) {

            try {
                const oModel = this.getView().getModel("systemDocuments");
                const oOperation = oModel.bindContext("/GetDocumentContent(...)");

                oOperation.setParameter(
                    "documentType",
                    oDocument.DocumentType
                );

                await oOperation.execute();

                const sBase64 = oOperation.getBoundContext().getObject().value;

                if (!sBase64) {
                    MessageBox.error("No fue posible obtener el documento.");
                    return;
                }
                this._openPdf(sBase64);
            } catch (err) {
                MessageBox.error(err.message || "Ocurrió un error al obtener el documento.");
            }

        },
        _openPdf: function (sBase64) {
            const sBinary = atob(sBase64);
            const aBytes = new Uint8Array(sBinary.length);
            for (let i = 0; i < sBinary.length; i++) {
                aBytes[i] = sBinary.charCodeAt(i);
            }
            const oBlob = new Blob([aBytes], {
                type: "application/pdf"
            });
            const sUrl = URL.createObjectURL(oBlob);
            window.open(sUrl, "_blank");
            setTimeout(() => URL.revokeObjectURL(sUrl), 1000);
        },
        _loadDocumentsMenu: async function () {
            try {

                const aDocuments = await this._getAvailableDocuments();
                this._buildDocumentsMenu(aDocuments);

            } catch (err) {
                console.error(err);
            }
        },
    });
});