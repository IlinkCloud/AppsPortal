sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment"
], (Controller, Fragment) => {
    "use strict";

    var oODataJSONModel = new sap.ui.model.json.JSONModel();

    return Controller.extend("mispedidosfront.controller.main", {
        onInit() {

            this._oUserAccessModel = new sap.ui.model.odata.v4.ODataModel({
                serviceUrl: "/odata/v4/invitacion/",
                synchronizationMode: "None",
                operationMode: "Server",
                autoExpandSelect: true
            });

            this._pInitialization = this._initializeApp();
            /*
            this.getView().addEventDelegate({
                onBeforeShow: function (oEvent) {
                    this.initDatePickers();
                    this.getOrders();
                }
            }, this);
            */
        },
        _initializeApp: async function () {
            const oView = this.getView();

            try {
                oView.setBusy(true);

                // Validar el registro del usuario en IAS
                await this.validateUserAccess();

                // Inicializar controles
                this.initDatePickers();

                // Consultar pedidos con la información ya actualizada
                await this.getOrders();

            } catch (error) {
                console.error("[Initialization] Error:", error);
            } finally {
                oView.setBusy(false);
            }
        },
        validateUserAccess: async function () {
            const oOperation = this._oUserAccessModel.bindContext("/ValidateUserAccess(...)");
            await oOperation.invoke();
            const oResult = oOperation.getBoundContext().getObject();
            console.log("[ValidateUserAccess] Respuesta:", oResult);
            return oResult;
        },
        getOrders: function () {

            var calendarStart = this.byId("startDatePicker");
            var calendarEnd = this.byId("endDatePicker");

            var startDate = calendarStart.getDateValue();
            var endDate = calendarEnd.getDateValue();

            // Convertir a string en formato YYYY-MM-DD
            var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "yyyy-MM-dd" });
            var StartDateStr = startDate ? oDateFormat.format(startDate) : "";
            var EndDateStr = endDate ? oDateFormat.format(endDate) : "";

            // Ajustar si están invertidas
            if (StartDateStr && EndDateStr && new Date(StartDateStr) > new Date(EndDateStr)) {
                var aux = StartDateStr;
                StartDateStr = EndDateStr;
                EndDateStr = aux;

                // Reacomodar en el UI
                var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "yyyy-MM-dd" });
                calendarStart.setDateValue(oDateFormat.parse(StartDateStr));
                calendarEnd.setDateValue(oDateFormat.parse(EndDateStr));
            }

            //StartDateStr
            //EndDateStr
            //console.log("Inicio:" + StartDateStr);
            //console.log("Fin:" + EndDateStr);

            // Construir filtro
            var sFilter = "";
            if (StartDateStr) {
                sFilter += "CreationDate ge " + StartDateStr;
            }
            if (EndDateStr) {
                sFilter += (sFilter ? " and " : "") + "CreationDate le " + EndDateStr;
            }

            // Construir URL final
            var sUrl = "/odata/v4/ord-compra/ReadListPO";
            if (sFilter) {
                sUrl += "?$filter=" + sFilter;
            }

            //console.log("URL generada:", sUrl);

            //var Supplier = 1000071;
            //"/odata/v4/ord-compra/ReadListPO?$filter=Supplier eq '" + Supplier + "'"
            fetch(sUrl, {
                method: "GET",
                headers: {
                    "Accept": "application/json"
                },
                credentials: "include"
            })
                .then(response => {
                    if (!response.ok) {
                        // Leer como texto para ver el mensaje de error real
                        return response.text().then(errText => {
                            throw new Error(`HTTP ${response.status} - ${errText}`);
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    // Poner la data en el modelo JSON
                    oODataJSONModel.setData(data);
                    // Asignar el modelo con nombre "vendor" al componente
                    this.getOwnerComponent().setModel(oODataJSONModel, "orders");
                })
                .catch(error => console.error("Error:", error));
        },
        orderDetails: function (oEvent) {
            // Obtenemos el binding del objeto
            var orderObject = oEvent.getSource().getBindingContext("orders").getObject();
            var order = new sap.ui.model.json.JSONModel();
            order.setData(orderObject);
            this.getOwnerComponent().setModel(order, "oDetails");

            this.getItemsOC(orderObject.PurchaseOrder);
        },
        getItemsOC: function (PurchaseOrder) {
            var oActives = {
                length: 0,
                table: []
            };
            var oDeliver = {
                length: 0,
                table: []
            };
            var oInvoice = {
                length: 0,
                table: []
            };
            fetch("/odata/v4/ord-compra/ReadDocFlow?$filter=PurchaseOrder eq '" + PurchaseOrder + "' and IsReturnsItem ne true", {
                method: "GET",
                headers: {
                    "Accept": "application/json"
                },
                credentials: "include"
            })
                .then(response => response.json())
                .then(data => {
                    // Actualizar nombre del proveedor en la cabecera
                    const oHeader = data.value?.[0];

                    if (oHeader) {

                        const oDetailsModel =
                            this.getOwnerComponent().getModel("oDetails");

                        if (
                            oDetailsModel &&
                            oDetailsModel.getProperty("/PurchaseOrder") === PurchaseOrder &&
                            String(oDetailsModel.getProperty("/Supplier")).trim() ===
                            String(oHeader.Supplier).trim()
                        ) {
                            oDetailsModel.setProperty(
                                "/SupplierName",
                                oHeader.SupplierName || ""
                            );
                        }

                    }
                    // Poner la data en el modelo JSON
                    //oODataJSONModel.setData(data);
                    // Asignar el modelo con nombre "vendor" al componente
                    //this.getOwnerComponent().setModel(oODataJSONModel, "oDetails");
                    const abiertos = data.value[0].to_Abiertos;
                    if (Array.isArray(abiertos) && abiertos.length > 0) {
                        oActives.table.push(...abiertos);
                    }
                    const entregados = data.value[0].to_Entregas;
                    if (Array.isArray(entregados) && entregados.length > 0) {
                        oDeliver.table.push(...entregados);
                    }
                    const facturados = data.value[0].to_Facturas;
                    if (Array.isArray(facturados) && facturados.length > 0) {
                        oInvoice.table.push(...facturados);
                    }

                    var jsActives = new sap.ui.model.json.JSONModel();
                    oActives.length = oActives.table.length;
                    jsActives.setData(oActives);
                    var jsDeliver = new sap.ui.model.json.JSONModel();
                    oDeliver.length = oDeliver.table.length;
                    jsDeliver.setData(oDeliver);
                    var jsInvoice = new sap.ui.model.json.JSONModel();
                    oInvoice.length = oInvoice.table.length;
                    jsInvoice.setData(oInvoice);

                    this.getOwnerComponent().setModel(jsActives, "iActive");
                    this.getOwnerComponent().setModel(jsDeliver, "iDeliver");
                    this.getOwnerComponent().setModel(jsInvoice, "iInvoiced");

                })
                .catch(error => console.error("Error:", error));
        },
        /*
        matDocuments: async function (evt) {
            var that = this;
            var vItem = evt.getSource().getBindingContext("iDeliver").getObject();

            if (vItem) {

                if (!this._oDialog) {
                    this._oDialog = await Fragment.load({
                        name: "mispedidosfront.fragments.MatDocLists",
                        controller: this
                    });
                    this.getView().addDependent(this._oDialog);
                }

                var vModel = this.getOwnerComponent().getModel("iDeliver");
                var oHistory = vModel.getProperty("/table");

                var listDocuments = {
                    items: []
                };

                oHistory.forEach(function (element) {
                    if (element.PurchaseOrderItem === vItem) {
                        var objDocument = {
                            docNo: "",
                            delivNote: "",
                            qty: "",
                            meins: ""
                        };
                        objDocument.docNo = element.MaterialDocument;
                        objDocument.delivNote = element.RefDocNo;
                        objDocument.qty = element.QuantityInBaseUnit;
                        objDocument.meins = element.EntryUnit

                        listDocuments.items.push(objDocument);
                    }
                });
                var oOdataDocuments = new sap.ui.model.json.JSONModel();
                oOdataDocuments.setData(listDocuments);

                this.getOwnerComponent().setModel(oOdataDocuments, "dDocument");

                this.getView().addDependent(this._oDialog);

                this._oDialog.open();
            }
        },
        */
        matDocuments: async function (evt) {
            const vItem = evt.getSource().getBindingContext("iDeliver").getObject();
            if (!vItem) return;

            if (!this._oDialog) {
                this._oDialog = await Fragment.load({
                    name: "mispedidosfront.fragments.MatDocLists",
                    controller: this
                });
                this.getView().addDependent(this._oDialog);
            }

            const vModel = this.getOwnerComponent().getModel("iDeliver");
            const oHistory = vModel.getProperty("/table") || [];

            const listDocuments = {
                items: oHistory
                    .filter(item => item.PurchaseOrderItem === vItem)
                    .map(item => ({
                        docNo: item.MaterialDocument,
                        delivNote: item.ReferenceDocument,
                        qty: item.QuantityInBaseUnit,
                        meins: item.EntryUnit
                    }))
            };

            if (listDocuments.items.length === 0) {
                sap.m.MessageToast.show(this.getOwnerComponent().getModel('i18n')
                    .getProperty("matdoc.noData"));
                return;
            }

            this.getOwnerComponent().setModel(new sap.ui.model.json.JSONModel(listDocuments), "dDocument");

            this._oDialog.open();
        },
        onCloseDialog: function () {
            if (this._oDialog) {
                this._oDialog.destroy();
                this._oDialog = null;
            }
        },
        onChangeDate: function (oEvent) {
            this.getOrders();
        },








        /////// GENERICOS
        /*
        getAppId: function () {
            var appName = "";
            var host = window.location.host;
            var isCF = host.includes("cfapps") || host.includes("ondemand");
            if (isCF) {
                appName = "/" + this.getOwnerComponent().getManifestEntry("sap.app").id;
            }
            return appName;
        },
        */
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
        formatDate: function (v) {
            if (v) {
                jQuery.sap.require("sap.ui.core.format.DateFormat");
                var oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({
                    pattern: "dd-MM-YYYY",
                    UTC: true
                });
                return oDateFormat.format(new Date(v));
            } else {
                return null;
            }
        },
        initDatePickers: function () {
            var calendarStart = this.byId("startDatePicker");
            var calendarEnd = this.byId("endDatePicker");
            var date = new Date();
            calendarStart.setMinDate(new Date(2000, 0, 1));
            calendarEnd.setMinDate(new Date(2000, 0, 1));
            calendarStart.setMaxDate(new Date(date));
            calendarEnd.setMaxDate(new Date(date));
            //var fechaIni = new Date();
            //fechaIni.setDate(fechaIni.getDate() - 7); //Fecha de hoy menos 7 días
            //fechaIni.setMonth(fechaIni.getMonth() - 1); //Fecha de hoy menos 1 mes
            var startDate = new Date(date.getFullYear(), 0, 1); //Fecha de inicio del año en curso
            calendarStart.setDateValue(startDate);

            //calendarStart.setDateValue(fechaIni);
            calendarEnd.setDateValue(date);
        }
    });
});