sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/ui/core/BusyIndicator",
    "sap/m/Dialog",
    "sap/m/Text",
    "sap/m/Button"
], (Controller, MessageBox, BusyIndicator, Dialog, Text, Button) => {

    "use strict";

    return Controller.extend("enviarfacturasfront.controller.main", {
        onInit() {
            this._setDefaultDates();
            this.getReadGoodsReceipt();
        },

        _setDefaultDates: function () {
            const oToday = new Date();
            const oStartOfYear = new Date(oToday.getFullYear(), 0, 1); // 1 de enero del año actual

            const oStartDatePicker = this.byId("startDatePicker");
            const oEndDatePicker = this.byId("endDatePicker");

            // Establecer fechas en los DatePickers (sin aplicar filtro aún)
            if (oStartDatePicker) oStartDatePicker.setDateValue(oStartOfYear);
            if (oEndDatePicker) oEndDatePicker.setDateValue(oToday);
        },

        /* getBusinessPartner: function () {
            BusyIndicator.show(100);
            const url = "/odata/v4/invitacion/ReadSupplier";
            fetch(url, { method: "GET", headers: { "Accept": "application/json" }, credentials: "include" })
                .then(res => {
                    return res.ok ? res.json() : res.text().then(t => { throw new Error(t); });
                })
                .then(data => {
                    const aContactos = (data.value || []).map(bp => ({
                        UserID: bp.BusinessPartner,
                        UserNombre: bp.SupplierName,
                        Supplier: bp.BusinessPartner,
                        CompanyCode: bp.CompanyCode,
                        CompanyCodeName: bp.CompanyCodeName,
                        Client: bp.CompanyCodeName
                    }));
                    let oModel = this.getView().getModel();
                    if (!oModel) {
                        oModel = new sap.ui.model.json.JSONModel({ UsrsDatos: [], Destinatario: null });
                        this.getView().setModel(oModel);
                    }
                    oModel.setProperty("/UsrsDatos", aContactos);

                    // === Establecer fechas por defecto ANTES de cargar documentos ===
                    this._setDefaultDates();

                    // === Pasar fechas al backend ===
                    const oStart = this.byId("startDatePicker").getDateValue();
                    const oEnd = this.byId("endDatePicker").getDateValue();
                    this.getReadGoodsReceipt(data.value, oStart, oEnd);

                    BusyIndicator.hide();
                })
                .catch(err => {
                    console.error("[getBusinessPartner] Error:", err);
                    MessageBox.error("Error al cargar destinatarios");
                    BusyIndicator.hide();
                });
        }, */


        getReadGoodsReceipt: function () {
            BusyIndicator.show(100);

            // === Obtener fechas de los DatePickers ===
            const oStart = this.byId("startDatePicker")?.getDateValue();
            const oEnd = this.byId("endDatePicker")?.getDateValue();
            const formatDate = (d) => d ? d.toISOString().split('T')[0] : null;

            let url = `/odata/v4/goods-receipts/ReadGoodsReceipt`;
            const params = [];
            if (formatDate(oStart)) params.push(`FromDate=${formatDate(oStart)}`);
            if (formatDate(oEnd)) params.push(`ToDate=${formatDate(oEnd)}`);
            if (params.length > 0) url += `?${params.join('&')}`;

            fetch(url, { method: "GET", headers: { "Accept": "application/json" }, credentials: "include" })
                .then(res => res.ok ? res.json() : res.text().then(t => { throw new Error(t); }))
                .then(data => {
                    const aFacturas = (data.value || []).map(item => ({
                        ...item,
                        DocumentDate: item.DocumentDate ? new Date(item.DocumentDate.replace(/Z$/, '')) : null
                    }));
                    this.getView().setModel(
                        new sap.ui.model.json.JSONModel({ results: aFacturas }),
                        "documents"
                    );
                    BusyIndicator.hide();
                })
                .catch(err => {
                    console.error("[getReadGoodsReceipt] Error:", err);
                    MessageBox.error("Error al cargar documentos");
                    BusyIndicator.hide();
                });
        },

        postEstatusFactura: function () {
            const url = "/odata/v4/goods-receipts/ValidarFactura";

            fetch(url, { method: "POST", headers: { "Accept": "application/json" }, credentials: "include" })
                .then(res => {
                    return res.ok ? res.json() : res.text().then(t => { throw new Error(t); });
                })
                .catch(err => console.error("[postEstatusFactura] Error:", err));
        },

        async postLogAttachmentPDF(file, documentId, supplier) {
            const url = "/odata/v4/goods-receipts/AdjuntarFacturaPDF";
            const sFileBase64 = await this._fileToBase64(file);
            const oPayload = {
                pdfBase64: sFileBase64,
                documentId,
                supplier
            };

            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(oPayload),
                    credentials: "include"
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText);
                }

                const data = await response.json();
                return { message: data.mensaje, success: true };
            } catch (err) {
                console.error("[postLogAttachmentPDF] Error:", err);
                return { message: "No fue posible subir el PDF", success: false };
            }
        },

        async postLogAttachmentXML(file, documentId, supplier) {
            const url = "/odata/v4/goods-receipts/AdjuntarFacturaXML";
            const sFileBase64 = await this._fileToBase64(file);
            const oPayload = {
                xmlBase64: sFileBase64,
                documentId,
                supplier
            };

            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(oPayload),
                    credentials: "include"
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText);
                }

                const data = await response.json();
                return { message: data.mensaje, success: true };
            } catch (err) {
                console.error("[postLogAttachmentPDF] Error:", err);
                return { message: "No fue posible subir el XML", success: false };
            }
        },

        postReturnSat: function () {
            const url = "/odata/v4/goods-receipts/validarCFDIEnSAT";

            fetch(url, { method: "POST", headers: { "Accept": "application/json" }, credentials: "include" })
                .then(res => {
                    return res.ok ? res.json() : res.text().then(t => { throw new Error(t); });
                })
                .catch(err => console.error("[postReturnSat] Error:", err));
        },

        postReturnSatPac: function () {
            const url = "/odata/v4/goods-receipts/ValidarCFDIListo";

            fetch(url, { method: "POST", headers: { "Accept": "application/json" }, credentials: "include" })
                .then(res => {
                    return res.ok ? res.json() : res.text().then(t => { throw new Error(t); });
                })
                .catch(err => console.error("[postReturnSatPac] Error:", err));
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

        onChangeDate: function () {
            console.log("[onChangeDate] Fechas cambiadas, recargando datos del backend...");

            // Obtener las fechas actuales de los DatePickers
            const oStart = this.byId("startDatePicker")?.getDateValue();
            const oEnd = this.byId("endDatePicker")?.getDateValue();

            console.log("[onChangeDate] Nueva fecha inicio:", oStart);
            console.log("[onChangeDate] Nueva fecha fin:", oEnd);

            // Recargar datos desde el backend con las nuevas fechas
            this.getReadGoodsReceipt();
        },

        filtrado: function (oEvent) {
            const sQuery = oEvent.getParameter("query");
            const sSelectedKey = this.byId("selectFilter").getSelectedKey();

            const oTable = this.byId("docMatList");
            const oBinding = oTable.getBinding("items");

            let aFilters = [];
            if (sQuery) {
                aFilters.push(new sap.ui.model.Filter(sSelectedKey, sap.ui.model.FilterOperator.Contains, sQuery));
            }

            oBinding.filter(aFilters, "Application");
        },

        validateSociety: function () {
            console.log("validateSociety triggered");
        },

        uploadButton: function () {
            const that = this;
            const oTable = that.byId("docMatList");
            const aSelected = oTable.getSelectedItems();


            if (aSelected.length === 0) {
                MessageBox.error("Debes seleccionar un documento en la tabla antes de subir archivos.");
                return;
            }

            this._showUploadFileDialog(aSelected);

        },

        _showUploadFileDialog(aSelected) {
            const oController = this;
            let aFiles;

            // === GUARDAR aSelected como propiedad del controlador ===
            this._aSelectedForUpload = aSelected;

            if (!this._oUploadDialog) {
                const oFileUploader = new sap.ui.unified.FileUploader({
                    id: "fileUploader",
                    name: "file",
                    multiple: true,
                    maximumFileSize: 2,
                    mimeType: ["application/pdf", "text/xml", "application/xml"],
                    change: function (oEvent) {
                        aFiles = Array.from(oEvent.getParameter("files"));
                        if (aFiles.length === 0) return;
                        oAnexosLabel.setText(`Anexos (${aFiles.length})`);
                        oFileList.removeAllItems();
                        aFiles.forEach(file => {
                            if (file.size > 2 * 1024 * 1024) {
                                MessageBox.error(
                                    `El archivo "${file.name}" excede el límite de 2 Mb.`
                                );
                                return;
                            }
                            if (!(file.type === "application/pdf" ||
                                file.type === "text/xml" ||
                                file.type === "application/xml")) {
                                MessageBox.error(
                                    `El archivo "${file.name}" no es válido. Solo se permiten PDF o XML.`
                                );
                                return;
                            }
                            oFileList.addItem(new sap.m.StandardListItem({ title: file.name }));
                        });
                    }
                });
                const oAnexosLabel = new sap.m.Label({
                    text: "Anexos (0)",
                    design: "Bold",
                    width: "100%",
                    textAlign: "Center"
                }).addStyleClass("sapUiTinyMarginTop");
                const oFileList = new sap.m.List({
                    headerText: "Archivos seleccionados",
                    visible: true,
                    items: []
                });
                this._oUploadDialog = new sap.m.Dialog({
                    title: "Cargar Archivos CFDI",
                    contentWidth: "550px",
                    contentHeight: "300px",
                    verticalScrolling: true,
                    horizontalScrolling: false,
                    content: [
                        new sap.m.VBox({
                            alignItems: "Center",
                            justifyContent: "Center",
                            width: "100%",
                            items: [
                                oAnexosLabel,
                                new sap.ui.core.Icon({ src: "sap-icon://document", size: "4rem" }),
                                new sap.m.Label({ text: "2 Mb", design: "Bold" }),
                                new sap.m.Text({ text: "Selecciona o Arrastra el XML y PDF", textAlign: "Center" }).addStyleClass("sapUiSmallMarginTop"),
                                oFileUploader,
                                oFileList.addStyleClass("sapUiSmallMarginTop")
                            ]
                        })
                    ],
                    beginButton: new sap.m.Button({
                        text: "Subir",
                        type: "Emphasized",
                        press: async function () {
                            let pdfFile = null;
                            let xmlFile = null;
                            let isTherePDF = false;
                            let isThereXML = false;
                            for (let i = 0; i < aFiles.length; i++) {
                                const oFile = aFiles[i];
                                const sName = oFile.name.split(".")[0];
                                const isValidName = /[a-zA-Z0-9]/.test(sName);
                                if (!sName || !isValidName) {
                                    MessageBox.error("Los nombres de los archivos deben contener letras y/o números");
                                    return;
                                }
                                if (oFile.type === "application/pdf") {
                                    isTherePDF = true;
                                }
                                if (oFile.type === "text/xml" || oFile.type === "application/xml") {
                                    isThereXML = true;
                                }
                            }
                            if (!isTherePDF || !isThereXML) {
                                MessageBox.error("Se requiere un documento XML y un PDF");
                                return;
                            }
                            BusyIndicator.show(100);

                            const oTable = oController.byId("docMatList");
                            const aCurrentSelected = oTable.getSelectedItems();

                            if (aCurrentSelected.length === 0) {
                                MessageBox.error("No hay documentos seleccionados. Por favor selecciona un documento.");
                                BusyIndicator.hide();
                                return;
                            }

                            // Obtener datos del PRIMER item seleccionado
                            const oFirstContext = aCurrentSelected[0].getBindingContext("documents");
                            const oFirstData = oFirstContext.getObject();

                            // === Validar que tengamos los datos necesarios ===
                            const documentId = oFirstData.MaterialDocument;
                            const proveedorId = oFirstData.Supplier;
                            const sociedadId = oFirstData.CompanyCode;
                            const fechaFactura = oFirstData.DocumentDate?.toISOString().split('T')[0];

                            console.log("[_showUploadFileDialog] Datos obtenidos:", {
                                documentId,
                                proveedorId,
                                sociedadId,
                                fechaFactura,
                                oFirstData
                            });

                            if (!proveedorId || !sociedadId) {
                                console.error("[_showUploadFileDialog] Datos faltantes:", {
                                    proveedorId,
                                    sociedadId,
                                    oFirstData
                                });
                                MessageBox.error(
                                    "Error: No se pudo obtener la información del proveedor o sociedad.\n" +
                                    "Por favor recarga la tabla e intenta nuevamente."
                                );
                                BusyIndicator.hide();
                                return;
                            }

                            for (const file of aFiles) {
                                const tipo = file.type;
                                if (tipo === "application/pdf") {
                                    pdfFile = file;
                                } else if (tipo === "text/xml" || tipo === "application/xml") {
                                    xmlFile = file;
                                    const reader = new FileReader();
                                    reader.onload = async function (e) {
                                        const xmlBase64 = btoa(unescape(encodeURIComponent(e.target.result)));
                                        const payload = {
                                            xmlBase64,
                                            proveedorId,
                                            sociedadId,
                                            tipoDocumento: "I",
                                            fechaFactura
                                        };
                                        try {
                                            const validacionPAC = await oController.getValidacionPAC();
                                            let urlValidacion;
                                            if (validacionPAC) {
                                                urlValidacion = "/odata/v4/goods-receipts/ValidarFacturaReglasPac";
                                                console.log("[Validación] Usando ValidarFacturaReglasPac (validación PAC activada)");
                                            } else {
                                                urlValidacion = "/odata/v4/goods-receipts/ValidarFactura";
                                                console.log("[Validación] Usando ValidarFactura (validación PAC desactivada)");
                                            }
                                            const res = await fetch(urlValidacion, {
                                                method: "POST",
                                                headers: {
                                                    "Content-Type": "application/json",
                                                    "Accept": "application/json"
                                                },
                                                body: JSON.stringify(payload),
                                                credentials: "include"
                                            });
                                            if (!res.ok) {
                                                const errText = await res.text();
                                                sap.m.MessageBox.error("Error al validar factura:\n" + errText);
                                                return;
                                            }
                                            const data = await res.json();
                                            if (data.valido) {
                                                if (data.datos) {
                                                    data.datos.Items = aCurrentSelected.map(oElement => {
                                                        const oContext = oElement.getBindingContext("documents");
                                                        const oData = oContext.getObject();
                                                        return {
                                                            MaterialDocument: oData.MaterialDocument || "",
                                                            MaterialDocumentItem: oData.MaterialDocumentItem || "1",
                                                            PurchaseOrder: oData.PurchaseOrder,
                                                            PurchaseOrderItem: String(oData.PurchaseOrderItem),
                                                            Supplier: oData.Supplier || data.datos.SUPPLIER,
                                                            Plant: oData.Plant || data.datos.SOCIETY,
                                                            QuantityInEntryUnit: oData.QuantityInEntryUnit || 1,
                                                            Importe: oData.EffectiveAmount || 0
                                                        };
                                                    });
                                                    data.datos.ReferenceDocument = aCurrentSelected.length > 0
                                                        ? aCurrentSelected[0].getBindingContext("documents").getObject().ReferenceDocument
                                                        : "";
                                                    data.datos.FixedUUID = data.datos.Comprobante?.['cfdi:CfdiRelacionados']?.['cfdi:CfdiRelacionado']?.['@_UUID'] || null;
                                                    oController._mostrarResumenCFDI(data.datos, pdfFile, xmlFile);
                                                }
                                            } else {
                                                const errores = data.errores || [data.mensaje] || ["Factura inválida"];
                                                const sDuplicatedMsg = errores.find(sError => sError.includes("está repetido"));
                                                if (sDuplicatedMsg) {
                                                    oController._showDuplicatedUUIDMessage(sDuplicatedMsg, aCurrentSelected);
                                                } else {
                                                    MessageBox.error("Factura inválida:\n" + errores.join("\n"));
                                                }
                                            }
                                            BusyIndicator.hide();
                                        } catch (err) {
                                            MessageBox.error("Error al validar factura:\n" + err.message);
                                            BusyIndicator.hide();
                                        }
                                    };
                                    reader.readAsBinaryString(file);
                                }
                            }
                            oController._oUploadDialog.close();
                        }
                    }),
                    endButton: new sap.m.Button({
                        text: "Cerrar",
                        type: "Reject",
                        press: function () {
                            oController._oUploadDialog.close();
                        }
                    }),
                    afterClose: function () {
                        oController._oUploadDialog.destroy();
                        oController._oUploadDialog = null;
                        // === LIMPIAR la propiedad ===
                        oController._aSelectedForUpload = null;
                    }
                });
            }
            this._oUploadDialog.open();
        },

        _showDuplicatedUUIDMessage(sMessage, aSelected) {
            const oDialog = new Dialog({
                type: "Message",
                title: "UUID Repetido",
                content: new Text({ text: sMessage }),
                beginButton: new Button({
                    type: "Emphasized",
                    text: "Ok",
                    press: function () {
                        oDialog.close();
                    }.bind(this)
                }),
                endButton: new Button({
                    text: "Cargar otra factura",
                    press: function () {
                        this._showUploadFileDialog(aSelected);
                        oDialog.close();
                    }.bind(this)
                }),
                afterClose: function () {
                    oDialog.destroy();
                }
            });

            oDialog.open();
        },

        getValidacionPAC: function () {
            return new Promise((resolve) => {
                const url = "/odata/v4/testing-mode/Test";
                fetch(url, {
                    method: "GET",
                    headers: { "Accept": "application/json" },
                    credentials: "include"
                })
                    .then(res => {
                        if (!res.ok) throw new Error("Error al obtener parámetros");
                        return res.json();
                    })
                    .then(data => {
                        const results = data.value || [];
                        if (results.length > 0) {
                            const param = results[0];
                            try {
                                const parsed = JSON.parse(param.ParamValue);
                                const validacionPAC = parsed.ValidacionPAC || false;
                                console.log("[getValidacionPAC] Valor:", validacionPAC);
                                resolve(validacionPAC);
                            } catch (err) {
                                console.error("[getValidacionPAC] Error parseando ParamValue:", err);
                                resolve(false); // Valor por defecto
                            }
                        } else {
                            console.log("[getValidacionPAC] No se encontraron parámetros, usando valor por defecto: false");
                            resolve(false); // Valor por defecto
                        }
                    })
                    .catch(err => {
                        console.error("[getValidacionPAC] Error:", err);
                        resolve(false); // Valor por defecto en caso de error
                    });
            });
        },

        _mostrarResumenCFDI: function (datosCFDI, pdfFile, xmlFile) {
            const oDialog = new sap.m.Dialog({
                id: "resumenCFDIDialog",
                title: "Resumen CFDI",
                content: [
                    new sap.m.Table({
                        columns: [
                            new sap.m.Column({ header: new sap.m.Label({ text: "Cliente" }) }),
                            new sap.m.Column({ header: new sap.m.Label({ text: "Factura" }) }),
                            new sap.m.Column({ header: new sap.m.Label({ text: "Subtotal" }) }),
                            new sap.m.Column({ header: new sap.m.Label({ text: "Impuesto retenido" }) }),
                            new sap.m.Column({ header: new sap.m.Label({ text: "Impuestos" }) }),
                            new sap.m.Column({ header: new sap.m.Label({ text: "Total" }) }),
                            new sap.m.Column({ header: new sap.m.Label({ text: "Acciones" }), hAlign: "Center" })
                        ],
                        items: [
                            new sap.m.ColumnListItem({
                                cells: [
                                    new sap.m.Text({ text: datosCFDI.RFC || "—" }),
                                    new sap.m.Text({ text: datosCFDI.FOLIO || "—" }),
                                    new sap.m.Text({ text: `${datosCFDI.SUBTOTAL || "0.00"} ${datosCFDI.CURRENCY}` }),
                                    new sap.m.Text({ text: `${datosCFDI.TOTAL_IMPUESTOSRET || "0.00"} ${datosCFDI.CURRENCY}` }),
                                    new sap.m.Text({ text: `${datosCFDI.TOTAL_IMPUESTOSTRAS || "0.00"} ${datosCFDI.CURRENCY}` }),
                                    new sap.m.Text({ text: `${datosCFDI.TOTAL || "0.00"} ${datosCFDI.CURRENCY}` }),
                                    new sap.m.HBox({
                                        justifyContent: "Center",
                                        items: [
                                            pdfFile ? new sap.m.Button({
                                                icon: "sap-icon://pdf-attachment",
                                                tooltip: "Ver PDF",
                                                press: () => this._verPDF(pdfFile)
                                            }).addStyleClass("sapUiSmallMarginEnd") : null,
                                            new sap.m.Button({
                                                icon: "sap-icon://upload",
                                                tooltip: "Subir a MIRO",
                                                type: "Emphasized",
                                                press: () => this._subirAFI(datosCFDI, pdfFile, xmlFile)
                                            }).addStyleClass("sapUiSmallMarginEnd"),
                                            new sap.m.Button({
                                                icon: "sap-icon://delete",
                                                tooltip: "Eliminar",
                                                type: "Reject",
                                                press: () => this._eliminarFactura(datosCFDI.Comprobante?.Folio)
                                            })
                                        ].filter(Boolean)
                                    })
                                ]
                            })
                        ]
                    })
                ],
                beginButton: new sap.m.Button({
                    text: "Cerrar",
                    type: "Reject",
                    press: function () {
                        oDialog.close();
                    }
                }),
                afterClose: function () {
                    oDialog.destroy();
                    // === Limpiar referencia ===
                    this._oResumenDialog = null;
                }.bind(this) // === Bind para acceder a this del controller ===
            });

            // === GUARDAR REFERENCIA AL DIÁLOGO ===
            this._oResumenDialog = oDialog;

            oDialog.open();
        },

        // === Validar tolerancia con impuesto real (se ejecuta ANTES de subir) ===
        _validateToleranceWithTax: async function (aSelected, datosCFDI) {
            console.log(`\n[Tolerancia] === INICIANDO VALIDACIÓN ===`);
            console.log(`[Tolerancia] Documentos seleccionados: ${aSelected.length}`);
            console.log(`[Tolerancia] Total CFDI: ${datosCFDI.TOTAL}`);

            const nMinTolerance = 150;
            const nMaxTolerance = 150;
            const aDeviations = [];

            // === Agrupar líneas por PurchaseOrder ===
            const poGroups = new Map();

            for (let i = 0; i < aSelected.length; i++) {
                const oElement = aSelected[i];
                const oContext = oElement.getBindingContext("documents");
                const oData = oContext.getObject();
                const po = oData.PurchaseOrder;

                if (!poGroups.has(po)) {
                    poGroups.set(po, {
                        po: po,
                        items: [],
                        totalEffectiveAmount: 0,
                        lines: []
                    });
                }

                const group = poGroups.get(po);
                group.items.push(oData.PurchaseOrderItem);
                group.totalEffectiveAmount += Number(oData.EffectiveAmount) || 0;
                group.lines.push(oElement);
            }

            console.log(`[Tolerancia] Órdenes de compra agrupadas: ${poGroups.size}`);

            // === Validar cada grupo de PO ===
            for (const [poKey, group] of poGroups) {
                console.log(`\n[Tolerancia] --- PO: ${poKey} ---`);
                console.log(`[Tolerancia] Items: ${group.items.join(', ')}`);
                console.log(`[Tolerancia] Total EffectiveAmount agrupado: ${group.totalEffectiveAmount.toFixed(2)}`);

                try {
                    // Obtener tasa de impuesto (usar la primera línea del grupo)
                    const taxRate = await this._getTaxRateFromPO(poKey).catch(err => {
                        console.warn(`[TaxRate] Fallback por error: ${err.message}`);
                        return 0.16;
                    });

                    console.log(`[Tolerancia] TaxRate usado: ${(taxRate * 100).toFixed(2)}%`);

                    // Calcular total con impuesto basado en la SUMA de todas las líneas
                    const nTotalWithTax = group.totalEffectiveAmount * (1 + taxRate);
                    const nInvoiceTotal = Number(datosCFDI.TOTAL);

                    console.log(`[Tolerancia] Cálculo:`);
                    console.log(`   Total EffectiveAmount (suma): ${group.totalEffectiveAmount.toFixed(2)}`);
                    console.log(`   TaxRate: ${taxRate}`);
                    console.log(`   Total con impuesto: ${nTotalWithTax.toFixed(2)}`);
                    console.log(`   Total factura: ${nInvoiceTotal}`);

                    const nLowerLimit = nTotalWithTax - nMinTolerance;
                    const nUpperLimit = nTotalWithTax + nMaxTolerance;

                    console.log(`[Tolerancia] Límites:`);
                    console.log(`   Límite inferior: ${nLowerLimit.toFixed(2)}`);
                    console.log(`   Límite superior: ${nUpperLimit.toFixed(2)}`);

                    if (nInvoiceTotal < nLowerLimit || nInvoiceTotal > nUpperLimit) {
                        const nDeviation = Math.abs(nTotalWithTax - nInvoiceTotal);
                        console.log(`[Tolerancia] DESVIACIÓN DETECTADA: ${nDeviation.toFixed(2)}`);

                        aDeviations.push({
                            po: poKey,
                            items: group.items,
                            expected: nTotalWithTax,
                            received: nInvoiceTotal,
                            deviation: nDeviation,
                            taxRate: taxRate * 100,
                            totalEffectiveAmount: group.totalEffectiveAmount
                        });
                    } else {
                        console.log(`[Tolerancia] Dentro del rango aceptable`);
                    }
                } catch (err) {
                    console.warn(`[Tolerancia] Error en PO ${poKey}: ${err.message}`);
                    continue;
                }
            }

            console.log(`\n[Tolerancia] === FIN VALIDACIÓN ===`);
            console.log(`[Tolerancia] Desviaciones encontradas: ${aDeviations.length}`);

            return aDeviations;
        },

        _verPDF: function (oFile) {
            if (!oFile) {
                sap.m.MessageToast.show("No hay archivo para visualizar");
                return;
            }

            if (oFile.type !== "application/pdf") {
                sap.m.MessageToast.show("El archivo seleccionado no es un PDF válido");
                return;
            }

            const sFileUrl = URL.createObjectURL(oFile);

            jQuery.sap.addUrlWhitelist("blob");

            if (!this._pdfViewer) {
                this._pdfViewer = new sap.m.PDFViewer({
                    width: "auto",
                    source: sFileUrl,
                    title: "Visualización de PDF",
                    isTrustedSource: true,
                    displayType: "Embedded"
                });
                this.getView().addDependent(this._pdfViewer);
            } else {
                this._pdfViewer.setSource(sFileUrl);
            }

            this._pdfViewer.open();
        },

        formatDateForFrontEnd(date, odataVersion = "V2") {
            if (!date) return null;
            const d = new Date(date);
            return odataVersion === "V2"
                ? `/Date(${d.getTime()})/`
                : d.toISOString();
        },

        _getTaxRateFromPO: async function (purchaseOrder) {
            console.log(`[TaxRate] Iniciando consulta para PO: ${purchaseOrder}`);
            try {
                const url = `/odata/v4/goods-receipts/GetTaxRateFromPO?purchaseOrder=${encodeURIComponent(purchaseOrder)}`;
                console.log(`[TaxRate] URL: ${url}`);

                const response = await fetch(url, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                    credentials: 'include'
                });

                console.log(`[TaxRate] Response status: ${response.status}`);
                if (!response.ok) {
                    console.warn(`[TaxRate] HTTP ${response.status} para PO ${purchaseOrder}`);
                    return 0.16; // Fallback
                }

                const data = await response.json();
                console.log(`[TaxRate] Response data:`, data);

                const firstItem = data.value?.[0]?.value?.[0] || data.value?.[0];

                console.log('=== DEBUG COMPLETO ===');
                console.log('data:', JSON.stringify(data, null, 2));
                console.log('firstItem usado:', firstItem);
                console.log('=== FIN DEBUG ===');

                const taxRateDecimal = firstItem?.TaxRateDecimal;
                const conditionRateRatio = firstItem?.ConditionRateRatio;

                console.log(`[TaxRate] TaxRateDecimal: ${taxRateDecimal}, ConditionRateRatio: ${conditionRateRatio}`);

                if (typeof taxRateDecimal === 'number' && !isNaN(taxRateDecimal) && taxRateDecimal > 0) {
                    console.log(`[TaxRate] PO ${purchaseOrder}: ${(taxRateDecimal * 100).toFixed(2)}%`);
                    return taxRateDecimal;
                }

                console.warn(`[TaxRate] Fallback a 16% para PO ${purchaseOrder}`);
                return 0.16; // Fallback si no hay dato válido
            } catch (err) {
                console.error(`[TaxRate] Error para PO ${purchaseOrder}: ${err.message}`);
                return 0.16; // Fallback seguro - NUNCA lanza error
            }
        },

        _subirAFI: async function (datosCFDI, pdfFile, xmlFile) {
            const oTable = this.getView().byId("docMatList");
            const aSelected = oTable.getSelectedItems();
            const nMinTolerance = 150;
            const nMaxTolerance = 150;
            let sInvoiceStatus = "5";

            // === Validar tolerancia (ahora agrupa por PO automáticamente) ===
            const aDeviations = await this._validateToleranceWithTax(aSelected, datosCFDI);

            if (aDeviations.length > 0) {
                const sResponse = await this._getDeviationConfirmation(aDeviations, nMaxTolerance, nMinTolerance);
                if (sResponse === "Cancelar") {
                    return;
                } else {
                    sInvoiceStatus = "A";
                }
            }

            BusyIndicator.show(100);

            try {
                // === Construir Items desde las líneas seleccionadas ===
                const aItems = aSelected.map(oElement => {
                    const oContext = oElement.getBindingContext("documents");
                    const oData = oContext.getObject();
                    return {
                        MaterialDocument: oData.MaterialDocument || "",
                        MaterialDocumentItem: oData.MaterialDocumentItem || "1",
                        PurchaseOrder: oData.PurchaseOrder,
                        PurchaseOrderItem: String(oData.PurchaseOrderItem),
                        Supplier: oData.Supplier || datosCFDI.SUPPLIER,
                        Plant: oData.Plant || oData.CompanyCode,
                        QuantityInEntryUnit: oData.QuantityInEntryUnit || 1,
                        Importe: oData.EffectiveAmount || 0
                    };
                });

                const payload = {
                    "Items": aItems,
                    "Reference": aSelected.length > 0 ? aSelected[0].getBindingContext("documents").getObject().ReferenceDocument : "",
                    "FixedUUID": datosCFDI.UUID,
                    "SupplierInvoiceStatus": sInvoiceStatus,
                    "CFDIData": {
                        UUID: datosCFDI.UUID,
                        SOCIETY: datosCFDI.SOCIETY,
                        FOLIO: String(datosCFDI.FOLIO),
                        SERIE: String(datosCFDI.SERIE),
                        SUPPLIER: datosCFDI.SUPPLIER,
                        RFC: datosCFDI.RFC,
                        INVOICE_DATE: datosCFDI.INVOICE_DATE,
                        CURRENCY: datosCFDI.CURRENCY,
                        SUBTOTAL: datosCFDI.SUBTOTAL,
                        DISCOUNT: datosCFDI.DISCOUNT,
                        TOTAL_IMPUESTOSTRAS: datosCFDI.TOTAL_IMPUESTOSTRAS,
                        TOTAL_IMPUESTOSRET: datosCFDI.TOTAL_IMPUESTOSRET,
                        TOTAL: datosCFDI.TOTAL,
                        FORM_OF_PAYMENT: String(datosCFDI.FORM_OF_PAYMENT),
                        PAYMENT_METHOD: String(datosCFDI.PAYMENT_METHOD),
                        CFDI_USE: datosCFDI.CFDI_USE,
                        ZED_RECEIPT_TYPE: datosCFDI.ZED_RECEIPT_TYPE,
                        XML: datosCFDI.XML
                    }
                };

                const res = await fetch("/odata/v4/goods-receipts/CreateSupplierInvoiceFromList", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Accept": "application/json" },
                    body: JSON.stringify(payload),
                    credentials: "include"
                });

                if (!res.ok) {
                    const errText = await res.text();
                    const userMessage = this._formatErrorMessage(errText, datosCFDI.CURRENCY);
                    sap.m.MessageBox.error(userMessage);
                    BusyIndicator.hide();
                    return;
                }

                const data = await res.json();

                // === Adjuntar PDF y XML ===
                const oMessagePDF = await this.postLogAttachmentPDF(pdfFile, data.SupplierInvoice, datosCFDI.SUPPLIER);
                const oMessageXML = await this.postLogAttachmentXML(xmlFile, data.SupplierInvoice, datosCFDI.SUPPLIER);

                const aResults = [
                    {
                        label: "Factura a MIRO",
                        message: `Factura enviada a MIRO. ID: ${data.SupplierInvoice || "sin ID"}`,
                        icon: "sap-icon://accounting-document-verification",
                        success: true
                    },
                    {
                        label: "Documento PDF",
                        message: oMessagePDF.message,
                        icon: "sap-icon://pdf-attachment",
                        success: oMessagePDF.success
                    },
                    {
                        label: "Documento XML",
                        message: oMessageXML.message,
                        icon: "sap-icon://excel-attachment",
                        success: oMessageXML.success
                    }
                ];

                this._showResultDialog(aResults);
                BusyIndicator.hide();

                // === Recargar tabla (sin depender del modelo) ===
                await this.getReadGoodsReceipt();

                // === Cerrar diálogo de resumen ===
                if (this._oResumenDialog) {
                    this._oResumenDialog.close();
                }
            } catch (err) {
                console.error("[_subirAFI] Error:", err);
                MessageBox.error("Error al subir factura a MIRO:\n" + (err.message || "Error desconocido"));
                BusyIndicator.hide();
            }
        },

        _showResultDialog: function (aResults) {
            const oVBox = new sap.m.VBox({
                items: [
                    ...aResults.map(function (item) {
                        return new sap.m.VBox({
                            items: [
                                new sap.m.ObjectStatus({
                                    text: item.label,
                                    icon: item.icon,
                                    state: item.success ? "Success" : "Error"
                                }),
                                new sap.m.Text({
                                    text: item.message
                                }).addStyleClass("sapUiSmallMarginBottom")
                            ]
                        }).addStyleClass("sapUiSmallMarginBottom");
                    })
                ]
            });

            const oDialog = new sap.m.Dialog({
                title: "Resultados",
                content: oVBox,
                beginButton: new sap.m.Button({
                    text: "Cerrar",
                    press: function () {
                        oDialog.close();
                    }
                }),
                afterClose: function () {
                    oDialog.destroy();
                }
            }).addStyleClass("sapUiResponsivePadding--content sapUiResponsivePadding--header sapUiResponsivePadding--footer sapUiResponsivePadding--subHeader");

            oDialog.open();
        },

        _eliminarFactura: function (folio) {
            MessageBox.confirm(`¿Deseas eliminar la factura ${folio}?`, {
                onClose: (oAction) => {
                    if (oAction === MessageBox.Action.OK) {
                        sap.m.MessageToast.show(`Factura ${folio} eliminada`);
                    }
                }
            });
        },

        _getDeviationConfirmation: function (aDeviations, nMaxQntyTolerance, nMinQntyTolerance) {
            // === Extraer datos de la desviación ===
            const firstDeviation = aDeviations[0];
            const nDeviation = typeof firstDeviation === 'object'
                ? firstDeviation.deviation
                : firstDeviation;
            const po = typeof firstDeviation === 'object' ? firstDeviation.po : null;
            const items = typeof firstDeviation === 'object' ? firstDeviation.items : null;
            const expected = typeof firstDeviation === 'object' ? firstDeviation.expected : null;
            const received = typeof firstDeviation === 'object' ? firstDeviation.received : null;
            const totalEffectiveAmount = typeof firstDeviation === 'object' ? firstDeviation.totalEffectiveAmount : null;

            // === Determinar tipo de desviación ===
            const isAboveMax = nDeviation > nMaxQntyTolerance;
            const isBelowMin = nMinQntyTolerance !== undefined && nDeviation < nMinQntyTolerance;

            // === Construir mensaje ===
            let sMessage = '';
            const itemsText = items ? ` (Items: ${items.join(', ')})` : '';

            if (isAboveMax) {
                sMessage = po
                    ? `La diferencia de ${nDeviation.toFixed(2)} supera la desviación máxima ${nMaxQntyTolerance}\n` +
                    `PO: ${po}${itemsText}\n` +
                    `Total OC (sin impuestos): ${totalEffectiveAmount?.toFixed(2) || 'N/A'}\n` +
                    `Esperado (con impuestos): ${expected?.toFixed(2)}\n` +
                    `Recibido en factura: ${received?.toFixed(2)}`
                    : `La diferencia ${nDeviation?.toFixed(2) || nDeviation} supera la desviación máxima ${nMaxQntyTolerance}`;
            } else if (isBelowMin) {
                sMessage = po
                    ? `La diferencia de ${nDeviation.toFixed(2)} está por debajo de la desviación mínima ${nMinQntyTolerance}\n` +
                    `PO: ${po}${itemsText}\n` +
                    `Total OC (sin impuestos): ${totalEffectiveAmount?.toFixed(2) || 'N/A'}\n` +
                    `Esperado (con impuestos): ${expected?.toFixed(2)}\n` +
                    `Recibido en factura: ${received?.toFixed(2)}`
                    : `La diferencia ${nDeviation?.toFixed(2) || nDeviation} está por debajo de la desviación mínima ${nMinQntyTolerance}`;
            } else {
                sMessage = `La diferencia ${nDeviation?.toFixed(2) || nDeviation} está fuera del rango aceptable`;
            }

            const pConfirmation = new Promise((resolve) => {
                const oDialog = new Dialog({
                    type: "Message",
                    title: isAboveMax ? "Desviación Máxima" : "Desviación Mínima",
                    content: new Text({ text: sMessage }),
                    beginButton: new Button({
                        type: "Emphasized",
                        text: "Enviar con desviación",
                        press: function () {
                            resolve("Enviar");
                            oDialog.close();
                        }.bind(this)
                    }),
                    endButton: new Button({
                        text: "Cargar otra factura",
                        press: function () {
                            resolve("Cancelar");
                            oDialog.close();
                        }.bind(this)
                    }),
                    afterClose: function () {
                        oDialog.destroy();
                    }
                });
                oDialog.open();
            });

            return pConfirmation;
        },

        mostrarError: function (errText, CURRENCY) {
            const balanceLineMatch = errText.match(/Balance not zero:[^]+credits:\s[\d.,]+/);

            if (balanceLineMatch) {
                const balanceLine = balanceLineMatch[0];
                const match = balanceLine.match(/debits:\s([\d.,]+)\s+credits:\s([\d.,]+)/);
                console.log("Entrando a mostrar mensaje de balance");
                if (match) {
                    const debits = parseFloat(match[1].replace(/,/g, ""));
                    const credits = parseFloat(match[2].replace(/,/g, ""));
                    const diff = (debits - credits).toFixed(2);

                    sap.m.MessageBox.error(
                        `El balance contable no cuadra.\n` +
                        `Débitos: ${debits.toLocaleString("es-MX")} ${CURRENCY}\n` +
                        `Créditos: ${credits.toLocaleString("es-MX")} ${CURRENCY}\n` +
                        `Diferencia: ${diff.toLocaleString("es-MX")} ${CURRENCY}`
                    );
                    return;
                }
            }

            // Caso TaxCode faltante
            if (errText.includes("Enter a tax code in item") || errText.includes("Falta TaxCode")) {
                sap.m.MessageBox.error(
                    "La orden de compra seleccionada no tiene código de impuesto configurado.\n" +
                    "Contacte al equipo de finanzas para corregirlo en S/4HANA."
                );
                return;
            }

            // Internal Server Error
            if (errText.includes("Internal Server Error")) {
                sap.m.MessageBox.error(
                    "Ocurrió un error interno en el servidor. Intente nuevamente o contacte al área de soporte."
                );
                return;
            }

            // Otros errores genéricos
            sap.m.MessageBox.error("Error al registrar la factura:\n" + errText);
        },

        _formatErrorMessage: function (errText, currency) {
            const cleanText = errText.replace(/\n/g, " ").trim();

            // Balance contable
            const balanceMatch = cleanText.match(/Balance not zero.*?debits:\s([\d.,]+)\s+credits:\s([\d.,]+)/);
            if (balanceMatch) {
                const debits = parseFloat(balanceMatch[1].replace(/,/g, ""));
                const credits = parseFloat(balanceMatch[2].replace(/,/g, ""));
                const diff = (debits - credits).toFixed(2);
                return `El balance contable no cuadra.\nDébitos: ${debits.toLocaleString("es-MX")} ${currency}\nCréditos: ${credits.toLocaleString("es-MX")} ${currency}\nDiferencia: ${diff.toLocaleString("es-MX")} ${currency}`;
            }

            // Duplicado de factura
            const duplicateMatch = cleanText.match(/potential duplicate exists \(inv\. (\d+) (\d{4})\)/);
            if (duplicateMatch) {
                const invoiceNumber = duplicateMatch[1];
                const year = duplicateMatch[2];
                return `La factura no se creó automáticamente porque ya existe un posible duplicado.\nFactura existente: ${invoiceNumber} (${year}).`;
            }

            // TaxCode faltante
            if (cleanText.includes("Enter a tax code in item") || cleanText.includes("Falta TaxCode")) {
                return "La orden de compra seleccionada no tiene código de impuesto configurado.\nContacte al equipo de finanzas para corregirlo en S/4HANA.";
            }

            // Internal Server Error
            if (cleanText.includes("Internal Server Error")) {
                return "Ocurrió un error interno en el servidor. Intente nuevamente o contacte al área de soporte.";
            }

            // Otros errores
            return "Error al registrar la factura:\n" + cleanText;
        },

        onFileSelected: function (oEvent) {
            const files = oEvent.getParameter("files");
            const documentId = "ID_DEL_DOCUMENTO";

            files.forEach(file => {
                if (file.type === "application/pdf") {
                    this.postLogAttachmentPDF(file, documentId);
                } else if (file.type === "text/xml" || file.type === "application/xml") {
                    this.postLogAttachmentXML(file, documentId);
                } else {
                    console.warn("Tipo de archivo no soportado:", file.type);
                }
            });
        },

        _fileToBase64(file) {
            const pFile = new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => {
                    const base64String = reader.result.split(",")[1];
                    resolve(base64String);
                };
                reader.onerror = error => reject(error);
            });

            return pFile;
        }
    });
});