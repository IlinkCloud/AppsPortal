sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/ui/model/odata/v4/ODataModel",
    "sap/ui/core/BusyIndicator",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
], function (Controller, MessageBox, ODataModel, BusyIndicator, Filter, FilterOperator, JSONModel, MessageToast) {
    "use strict";

    return Controller.extend("enviarfacturaextfront.controller.MainView", {
        onInit: function () {
            this._setModels();
            this._setDefaultDates();
            this.getReadGoodsReceipt();
        },

        _setModels() {
            this._oAclaModel = new ODataModel({
                serviceUrl: "/odata/v4/aclaraciones/",
                synchronizationMode: "None",
                operationMode: "Server"
            });


            const oGoodsReceiptsModel = new ODataModel({
                serviceUrl: "/odata/v4/goods-receipts/",
                synchronizationMode: "None",
                operationMode: "Server"
            });

            this.getView().setModel(
                oGoodsReceiptsModel,
                "goodsReceipts"
            );

            const oInvoiceExternalModel = new JSONModel({
                InvoiceNumber: "",
                Subtotal: "",
                Total: "",
                InvoiceDate: "",
                PaymentMethod: "",
                Currency: ""
            });

            this.getView().setModel(
                oInvoiceExternalModel,
                "invoiceExternal"
            );
        },

        _setDefaultDates() {
            const oToday = new Date();
            const oStartOfYear = new Date(oToday.getFullYear(), 0, 1); // 1 de enero del año actual

            const oStartDatePicker = this.byId("startDatePicker");
            const oEndDatePicker = this.byId("endDatePicker");

            // Establecer fechas en los DatePickers (sin aplicar filtro aún)
            if (oStartDatePicker) oStartDatePicker.setDateValue(oStartOfYear);
            if (oEndDatePicker) oEndDatePicker.setDateValue(oToday);
        },

        onSearch: function (oEvent) {
            const sQuery = oEvent.getParameter("newValue") ??
                oEvent.getParameter("query") ?? "";

            const oTable = this.byId("docMatList");
            const oBinding = oTable.getBinding("items");

            if (!oBinding) {
                return;
            }

            const sSearch = sQuery.trim();

            if (!sSearch) {
                oBinding.filter([]);
                return;
            }

            const aFilters = [
                "DeliveryNumber",
                "PurchaseOrder",
                "PurchaseOrderItem",
                "MaterialItem",
                "SupplierName",
                "Customer",
                "Reference",
                "ConditionType"
            ].map(sProperty =>
                new Filter(
                    sProperty,
                    FilterOperator.Contains,
                    sSearch
                )
            );

            const oFilter = new Filter({
                filters: aFilters,
                and: false
            });

            oBinding.filter(oFilter);
        },

        onChangeDate: function () {
            console.log("[onChangeDate] Fechas cambiadas, recargando datos del backend...");

            // Recargar datos desde el backend con las nuevas fechas
            this.getReadGoodsReceipt();
        },

        async getReadGoodsReceipt() {
            BusyIndicator.show(0);

            const oModel = this.getView().getModel("goodsReceipts");
            let oOperation;

            try {
                // Obtener fechas de los DatePickers
                const oStart = this.byId("startDatePicker")?.getDateValue();
                const oEnd = this.byId("endDatePicker")?.getDateValue();

                // Formatear fechas sin conversión UTC
                const formatDate = (d) => {
                    if (!d) return null;

                    const iYear = d.getFullYear();
                    const iMonth = String(d.getMonth() + 1).padStart(2, "0");
                    const iDay = String(d.getDate()).padStart(2, "0");

                    return `${iYear}-${iMonth}-${iDay}`;
                };

                const sFromDate = formatDate(oStart);
                const sToDate = formatDate(oEnd);

                // Crear binding de la función OData
                oOperation = oModel.bindContext("/ReadGoodsReceipt(...)");

                // Establecer parámetros
                if (sFromDate) {
                    oOperation.setParameter("FromDate", sFromDate);
                }

                if (sToDate) {
                    oOperation.setParameter("ToDate", sToDate);
                }

                // Ejecutar función
                await oOperation.invoke();

                // Obtener resultado
                const oContext = oOperation.getBoundContext();
                const aResults = await oContext.requestObject("value");

                const aFacturas = (aResults || []).map(item => ({
                    ...item,
                    DocumentDate: item.DocumentDate
                        ? new Date(item.DocumentDate.replace(/Z$/, ""))
                        : null
                }));

                // Crear modelo JSON para la tabla
                const oJSONModel = new JSONModel({
                    results: aFacturas
                });

                oJSONModel.setSizeLimit(9999);

                this.getView().setModel(oJSONModel, "documents");
                this._addDummyGoodsReceipts();

                console.log("FACTURAS:", aFacturas);

            } catch (err) {
                console.error("[getReadGoodsReceipt] Error:", err);
                MessageBox.error("Error al cargar documentos");

            } finally {
                BusyIndicator.hide();

                if (oOperation) {
                    oOperation.destroy();
                }
            }
        },

        uploadButton: async function () {
            if (!this._oExternalInvoiceDialog) {
                this._oExternalInvoiceDialog = await this.loadFragment({
                    name: "enviarfacturaextfront.fragment.UploadExternalInvoice"
                });
            }

            this._oExternalInvoiceDialog.open();
        },

        onInvoicePdfChange: function (oEvent) {
            const oFile = oEvent.getParameter("files")?.[0];

            this._oInvoicePdfFile = oFile || null;

            this.byId("selectedPdfName").setText(
                oFile ? oFile.name : "Ningún archivo seleccionado"
            );

            this.byId("btnProcessInvoice").setEnabled(!!oFile);
        },

        onProcessInvoice: async function () {

            if (!this._oInvoicePdfFile) {
                MessageBox.warning("Selecciona un archivo PDF.");
                return;
            }

            const oInvoiceModel = this.getView().getModel("invoiceExternal");

            try {
                this._oExternalInvoiceDialog.setBusy(true);
                console.log("Enviando factura al back");
                console.log("Archivo:", this._oInvoicePdfFile.name);

                // Simulación de respuesta del backend
                await new Promise(resolve => setTimeout(resolve, 1500));

                const oResponse = {
                    InvoiceNumber: "FAC-2026-00125",
                    Subtotal: 12500.00,
                    Total: 14500.00,
                    InvoiceDate: "2026-11-05",
                    PaymentMethod: "transferencia",
                    Currency: "MXN"
                };

                oInvoiceModel.setData(oResponse);

                MessageToast.show("Factura procesada correctamente.");

            } catch (oError) {
                console.error("Error al procesar la factura:", oError);
                MessageBox.error("Ocurrió un error al procesar la factura.");
            } finally {
                this._oExternalInvoiceDialog.setBusy(false);
            }

        },
        onCerrarDialog: function () {
            this._clearExternalInvoice();
            this._oExternalInvoiceDialog.close();
        },
        _clearExternalInvoice: function () {
            const oInvoiceModel = this.getView().getModel("invoiceExternal");

            // Limpiar datos del formulario
            oInvoiceModel.setData({
                InvoiceNumber: "",
                Subtotal: "",
                Total: "",
                InvoiceDate: "",
                PaymentMethod: "",
                Currency: ""
            });

            // Limpiar archivo PDF
            this._oInvoicePdfFile = null;

            // Restablecer FileUploader
            this.byId("invoicePdfUploader").clear();

            // Restablecer nombre del archivo
            this.byId("selectedPdfName").setText("Ningún archivo seleccionado");

            // Deshabilitar procesamiento
            this.byId("btnProcessInvoice").setEnabled(false);
        },













        _addDummyGoodsReceipts() {
            const oModel = this.getView().getModel("documents");

            if (!oModel) {
                console.warn("No existe el modelo documents");
                return;
            }

            const aDummyData = [
                {
                    DeliveryNumber: "1800000125",
                    PurchaseOrder: "4500001234",
                    PurchaseOrderItem: "00010",
                    MaterialItem: "000001",
                    SupplierName: "Distribuidora Industrial del Centro",
                    Customer: "1000001",
                    Reference: "FAC-2026-00125",
                    ConditionType: "PB00",
                    DocumentDate: new Date(2026, 9, 15),
                    PurchaseOrderAmount: 12500.00,
                    GoodsReceiptAmount: 12500.00,
                    DocumentCurrency: "MXN"
                },
                {
                    DeliveryNumber: "1800000126",
                    PurchaseOrder: "4500001235",
                    PurchaseOrderItem: "00020",
                    MaterialItem: "000002",
                    SupplierName: "Comercializadora del Norte",
                    Customer: "1000002",
                    Reference: "FAC-2026-00126",
                    ConditionType: "PB00",
                    DocumentDate: new Date(2026, 9, 18),
                    PurchaseOrderAmount: 8750.50,
                    GoodsReceiptAmount: 8750.50,
                    DocumentCurrency: "MXN"
                },
                {
                    DeliveryNumber: "1800000127",
                    PurchaseOrder: "4500001236",
                    PurchaseOrderItem: "00010",
                    MaterialItem: "000003",
                    SupplierName: "Suministros y Servicios Mexicanos",
                    Customer: "1000003",
                    Reference: "REF-2026-0089",
                    ConditionType: "ZPR0",
                    DocumentDate: new Date(2026, 9, 20),
                    PurchaseOrderAmount: 25000.00,
                    GoodsReceiptAmount: 18500.00,
                    DocumentCurrency: "MXN"
                },
                {
                    DeliveryNumber: "1800000128",
                    PurchaseOrder: "4500001237",
                    PurchaseOrderItem: "00030",
                    MaterialItem: "000004",
                    SupplierName: "Tecnología y Componentes SA",
                    Customer: "1000004",
                    Reference: "FAC-2026-00128",
                    ConditionType: "PB00",
                    DocumentDate: new Date(2026, 10, 3),
                    PurchaseOrderAmount: 43200.00,
                    GoodsReceiptAmount: 43200.00,
                    DocumentCurrency: "MXN"
                },
                {
                    DeliveryNumber: "1800000129",
                    PurchaseOrder: "4500001238",
                    PurchaseOrderItem: "00010",
                    MaterialItem: "000005",
                    SupplierName: "Distribuidora Industrial del Centro",
                    Customer: "1000001",
                    Reference: "REF-2026-0095",
                    ConditionType: "ZPR0",
                    DocumentDate: new Date(2026, 10, 5),
                    PurchaseOrderAmount: 15600.00,
                    GoodsReceiptAmount: 9800.00,
                    DocumentCurrency: "MXN"
                }
            ];

            const aResults = oModel.getProperty("/results") || [];

            oModel.setProperty("/results", [
                ...aResults,
                ...aDummyData
            ]);
        },
    });
});