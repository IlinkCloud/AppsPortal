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
            this.getNotificaciones();
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
        async getNotificaciones() {
            try {
                sap.ui.core.BusyIndicator.show(0);
                const oAction = this._oNotifiModel.bindContext("/getMyNotifications(...)");
                await oAction.execute();
                const aResults = oAction.getBoundContext().getObject();
                console.log(aResults);
            } catch (error) {
                console.error(error);
                sap.m.MessageBox.error("Error al obtener notificaciones");
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

        /*
        getBusinessPartner: function () {
            const url = "/odata/v4/invitacion/ReadSupplier";
            console.log("[getBusinessPartner] URL:", url);
        
            fetch(url, { method: "GET", headers: { "Accept": "application/json" }, credentials: "include" })
                .then(res => {
                    console.log("[getBusinessPartner] Respuesta:", res.status, res.statusText);
                    return res.ok ? res.json() : res.text().then(t => { throw new Error(t); });
                })
                .then(data => {
                    console.log("[getBusinessPartner] Datos crudos:", data);
                    const aContactos = (data.value || []).map(bp => ({
                        UserID: bp.BusinessPartner,
                        UserNombre: bp.SupplierName,
                    }));
                    console.table(aContactos);
                    this.getView().getModel().setProperty("/UsrsDatos", aContactos);
                })
                .catch(err => console.error("[getBusinessPartner] Error:", err));
        },
        */
        /*
        filtrado: function (oEvent) {
            const sQuery = oEvent.getParameter("newValue");
            const sKey = this.byId("selectFilter").getSelectedKey();

            const oTable = this.byId("idTableAcla");
            const oBinding = oTable.getBinding("items");

            let aFilters = [];
            if (sQuery && sKey) {
                aFilters.push(new sap.ui.model.Filter(sKey, sap.ui.model.FilterOperator.Contains, sQuery));
            }
            oBinding.filter(aFilters);
        },
        */
    });
});