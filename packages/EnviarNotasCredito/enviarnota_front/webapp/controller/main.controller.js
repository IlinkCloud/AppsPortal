sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Icon",
    "sap/ui/core/BusyIndicator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/Dialog",
    "sap/m/Text",
    "sap/m/Button"
], (Controller, Icon, BusyIndicator, MessageBox, MessageToast, Dialog, Text, Button) => {
    "use strict";
    return Controller.extend("enviarnotafront.controller.main", {
        onInit: function () {
            this.getView().setModel(new sap.ui.model.json.JSONModel({ Sociedades: [] }), "sociedades");
            this._setDefaultDates();
            this.getCreditNotesReceipt();
        },

        _setDefaultDates: function () {
            const oToday = new Date();
            const oStartOfYear = new Date(oToday.getFullYear(), 0, 1);
            const oStartDatePicker = this.byId("startDatePicker");
            const oEndDatePicker = this.byId("endDatePicker");
            if (oStartDatePicker) oStartDatePicker.setDateValue(oStartOfYear);
            if (oEndDatePicker) oEndDatePicker.setDateValue(oToday);
        },

        getCreditNotesReceipt: function () {
            BusyIndicator.show(100);
            const oStart = this.byId("startDatePicker")?.getDateValue();
            const oEnd = this.byId("endDatePicker")?.getDateValue();
            const formatDate = (d) => d ? d.toISOString().split('T')[0] : null;
            let url = `/odata/v4/credit-notes-reception/ReadCreditNotesReceipt`;
            const params = [];
            if (formatDate(oStart)) params.push(`FromDate=${formatDate(oStart)}`);
            if (formatDate(oEnd)) params.push(`ToDate=${formatDate(oEnd)}`);
            if (params.length > 0) url += `?${params.join('&')}`;

            fetch(url, {
                method: "GET",
                headers: { "Accept": "application/json" },
                credentials: "include"
            })
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
                    console.error("[getCreditNotesReceipt] Error:", err);
                    MessageBox.error("Error al cargar documentos");
                    BusyIndicator.hide();
                });
        },

        async postLogAttachmentPDF(file, documentId, supplier, invoiceStatus) {
            const url = "/odata/v4/credit-notes-reception/AdjuntarFacturaPDF";
            const sFileBase64 = await this._fileToBase64(file);
            const oPayload = {
                pdfBase64: sFileBase64,
                documentId,
                supplier,
                "SupplierInvoiceStatus": invoiceStatus
            };
            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
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

        async postLogAttachmentXML(file, documentId, supplier, invoiceStatus) {
            const url = "/odata/v4/credit-notes-reception/AdjuntarFacturaXML";
            const sFileBase64 = await this._fileToBase64(file);
            const oPayload = {
                xmlBase64: sFileBase64,
                documentId,
                supplier,
                "SupplierInvoiceStatus": invoiceStatus
            };
            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
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
                console.error("[postLogAttachmentXML] Error:", err);
                return { message: "No fue posible subir el XML", success: false };
            }
        },

        postReturnSat: function () {
            const url = "/odata/v4/credit-notes-reception/validarCFDIEnSAT";
            fetch(url, {
                method: "POST",
                headers: { "Accept": "application/json" },
                credentials: "include"
            })
                .then(res => res.ok ? res.json() : res.text().then(t => { throw new Error(t); }))
                .catch(err => console.error("[postReturnSat] Error:", err));
        },

        postReturnSatPac: function () {
            const url = "/odata/v4/credit-notes-reception/ValidarCFDIListo";
            fetch(url, {
                method: "POST",
                headers: { "Accept": "application/json" },
                credentials: "include"
            })
                .then(res => res.ok ? res.json() : res.text().then(t => { throw new Error(t); }))
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
            const oStart = this.byId("startDatePicker")?.getDateValue();
            const oEnd = this.byId("endDatePicker")?.getDateValue();
            console.log("[onChangeDate] Nueva fecha inicio:", oStart);
            console.log("[onChangeDate] Nueva fecha fin:", oEnd);
            this.getCreditNotesReceipt();
        },

        filtrado: function (oEvent) {
            const sQuery = oEvent.getParameter("newValue") || oEvent.getParameter("query") || "";
            const sSelectedKey = this.byId("selectFilter").getSelectedKey();
            const oTable = this.byId("docMatList");
            const oBinding = oTable.getBinding("items");
            let aFilters = [];
            if (sQuery) {
                aFilters.push(new sap.ui.model.Filter(
                    sSelectedKey,
                    sap.ui.model.FilterOperator.Contains,
                    String(sQuery)
                ));
            }
            oBinding.filter(aFilters, "Application");
        },

        onTableSelectionChange: function (oEvent) {
            // Evita bucles infinitos si el evento se dispara al deseleccionar programáticamente
            if (this._isProcessingSelection) return;
            this._isProcessingSelection = true;

            const oTable = this.byId("docMatList");
            const aSelected = oTable.getSelectedItems();

            // Identificar items que NO deberían haber sido seleccionados (Lista Negra)
            const aInvalidSelection = aSelected.filter(item => {
                const ctx = item.getBindingContext("documents");
                return ctx && ctx.getObject().isBlackListed === true;
            });

            if (aInvalidSelection.length > 0) {
                // Deseleccionar inmediatamente los items de lista negra
                aInvalidSelection.forEach(item => oTable.setSelectedItem(item, false));

                // Mensaje opcional para el usuario
                sap.m.MessageToast.show("Este proveedor está en Lista Negra y no puede ser seleccionado.");
            }

            // Liberar el bloqueo en el siguiente ciclo de eventos
            setTimeout(() => { this._isProcessingSelection = false; }, 0);
        },

        validateSociety: function () {
            console.log("validateSociety triggered");
        },

        // ===Método simplificado que llama a _showUploadFileDialog ===
        uploadButton: function () {
            const that = this;
            const oTable = that.byId("docMatList");
            const aSelected = oTable.getSelectedItems();
            if (aSelected.length === 0) {
                MessageBox.warning("Debes seleccionar un documento en la tabla antes de subir archivos.");
                return;
            }
            this._showUploadFileDialog(aSelected);
        },

        // ===Diálogo de subida estructurado (desde Factura) ===
        _showUploadFileDialog(aSelected) {
            const oController = this;
            let aFiles;
            this._aSelectedForUpload = aSelected;

            if (!this._oUploadDialog) {
                const oFileUploader = new sap.ui.unified.FileUploader({
                    id: "fileUploader",
                    name: "file",
                    multiple: true,
                    maximumFileSize: 10,
                    mimeType: ["application/pdf", "text/xml", "application/xml"],
                    change: function (oEvent) {
                        aFiles = Array.from(oEvent.getParameter("files"));
                        if (aFiles.length === 0) return;
                        oAnexosLabel.setText(`Anexos (${aFiles.length})`);
                        oFileList.removeAllItems();
                        aFiles.forEach(file => {
                            if (file.size > 10 * 1024 * 1024) {
                                MessageBox.warning(`El archivo "${file.name}" excede el límite de 10 Mb.`);
                                return;
                            }
                            if (!(file.type === "application/pdf" ||
                                file.type === "text/xml" ||
                                file.type === "application/xml")) {
                                MessageBox.warning(`El archivo "${file.name}" no es válido. Solo se permiten PDF o XML.`);
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
                                new sap.m.Label({ text: "10 Mb", design: "Bold" }),
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
                                    MessageBox.warning("Los nombres de los archivos deben contener letras y/o números");
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
                                MessageBox.warning("Se requiere un documento XML y un PDF");
                                return;
                            }

                            BusyIndicator.show(100);
                            const oTable = oController.byId("docMatList");
                            const aCurrentSelected = oTable.getSelectedItems();
                            if (aCurrentSelected.length === 0) {
                                MessageBox.warning("No hay documentos seleccionados. Por favor selecciona un documento.");
                                BusyIndicator.hide();
                                return;
                            }

                            const oFirstContext = aCurrentSelected[0].getBindingContext("documents");
                            const oFirstData = oFirstContext.getObject();
                            const documentId = oFirstData.MaterialDocument;
                            const proveedorId = oFirstData.Supplier;
                            const sociedadId = oFirstData.Plant;
                            const fechaFactura = oFirstData.DocumentDate?.toISOString().split('T')[0];

                            console.log("[_showUploadFileDialog] Datos obtenidos:", {
                                documentId,
                                proveedorId,
                                sociedadId,
                                fechaFactura,
                                oFirstData
                            });

                            if (!proveedorId || !sociedadId) {
                                console.error("[_showUploadFileDialog] Datos faltantes:", { proveedorId, sociedadId, oFirstData });
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
                                        const documentDate = oFirstData.DocumentDate
                                            ? oFirstData.DocumentDate.toISOString().split('T')[0]
                                            : null;
                                        // === Tipo de documento "E" para nota de crédito ===
                                        const payload = {
                                            xmlBase64,
                                            proveedorId,
                                            sociedadId,
                                            tipoDocumento: "E",
                                            fechaFactura,
                                            documentDate: documentDate
                                        };

                                        try {
                                            const urlValidacion = "/odata/v4/goods-receipts/ValidarFactura";
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
                                                sap.m.MessageBox.warning("Error al validar nota de crédito:\n" + errText);
                                                return;
                                            }

                                            const data = await res.json();
                                            if (data.valido) {
                                                if (data.datos) {
                                                    console.log('[ValidarFactura] Retenciones recibidas:', {
                                                        tiene: !!data.datos.RetencionesConCodigos,
                                                        longitud: Array.isArray(data.datos.RetencionesConCodigos) ? data.datos.RetencionesConCodigos.length : 'N/A',
                                                        primerItem: Array.isArray(data.datos.RetencionesConCodigos) ? data.datos.RetencionesConCodigos[0] : null
                                                    });

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
                                                const errores = data.errores || [data.mensaje] || ["Nota de crédito inválida"];
                                                const sDuplicatedMsg = errores.find(sError => sError.includes("está repetido") || sError.includes("UUID"));
                                                if (sDuplicatedMsg) {
                                                    oController._showDuplicatedUUIDMessage(sDuplicatedMsg, aCurrentSelected);
                                                } else {
                                                    MessageBox.warning("Nota de crédito inválida:\n" + errores.join("\n"));
                                                }
                                            }
                                            BusyIndicator.hide();
                                        } catch (err) {
                                            MessageBox.warning("Error al validar nota de crédito:\n" + err.message);
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
                        oController._aSelectedForUpload = null;
                    }
                });
            }
            this._oUploadDialog.open();
        },

        // ===Diálogo para UUID duplicado ===
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
                    text: "Cargar otra nota de crédito",
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
                    this._oResumenDialog = null;
                }.bind(this)
            });
            this._oResumenDialog = oDialog;
            oDialog.open();
        },

        // ===Validación de tolerancia con TaxCode (desde Factura) ===
        _validateToleranceWithTax: async function (aSelected, datosCFDI) {
            console.log(`\n[Tolerancia] === INICIANDO VALIDACIÓN ===`);
            console.log(`[Tolerancia] Documentos seleccionados: ${aSelected.length}`);
            console.log(`[Tolerancia] Total CFDI: ${datosCFDI.TOTAL}`);

            const nMinTolerance = 150;
            const nMaxTolerance = 150;
            const aDeviations = [];

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

            for (const [poKey, group] of poGroups) {
                console.log(`\n[Tolerancia] --- PO: ${poKey} ---`);
                console.log(`[Tolerancia] Items: ${group.items.join(', ')}`);
                console.log(`[Tolerancia] Total EffectiveAmount agrupado: ${group.totalEffectiveAmount.toFixed(2)}`);

                try {
                    const taxRate = await this._getTaxRateFromPO(poKey).catch(err => {
                        console.warn(`[TaxRate] Fallback por error: ${err.message}`);
                        return 0.16;
                    });
                    console.log(`[Tolerancia] TaxRate usado: ${(taxRate * 100).toFixed(2)}%`);

                    /* retenciones
                    const nTotalWithTax = group.totalEffectiveAmount * (1 + taxRate);
                    */
                    // === INICIO  RETENCIONES: 
                    const nTotalTaxes = group.totalEffectiveAmount * taxRate;
                    const nTotalRetenciones = Number(datosCFDI.TOTAL_IMPUESTOSRET || 0);
                    const nTotalWithTax = group.totalEffectiveAmount + nTotalTaxes - nTotalRetenciones;
                    // === FIN RETENCIONES: 

                    const nInvoiceTotal = Number(datosCFDI.TOTAL);

                    console.log(`[Tolerancia] Cálculo:`);
                    console.log(`   Total EffectiveAmount (suma): ${group.totalEffectiveAmount.toFixed(2)}`);
                    console.log(`   TaxRate: ${taxRate}`);
                    console.log(`   Total con impuesto: ${nTotalWithTax.toFixed(2)}`);
                    console.log(`   Total nota de crédito: ${nInvoiceTotal}`);
                    // === INICIO  RETENCIONES: 
                    console.log(`   Total impuestos trasladados calculado: ${nTotalTaxes.toFixed(2)}`);
                    console.log(`   Total retenciones XML: ${nTotalRetenciones.toFixed(2)}`);
                    console.log(`   Total con impuesto menos retenciones: ${nTotalWithTax.toFixed(2)}`);
                    // === FIN RETENCIONES: 

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

        // ===Obtener TaxCode desde la PO (desde Factura) ===
        _getTaxRateFromPO: async function (purchaseOrder) {
            console.log(`[TaxRate] Iniciando consulta para PO: ${purchaseOrder}`);
            try {
                const url = `/odata/v4/credit-notes-reception/GetTaxRateFromPO?purchaseOrder=${encodeURIComponent(purchaseOrder)}`;
                console.log(`[TaxRate] URL: ${url}`);
                const response = await fetch(url, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                    credentials: 'include'
                });
                console.log(`[TaxRate] Response status: ${response.status}`);
                if (!response.ok) {
                    console.warn(`[TaxRate] HTTP ${response.status} para PO ${purchaseOrder}`);
                    return 0.16;
                }
                const data = await response.json();
                console.log(`[TaxRate] Response data:`, data);
                const firstItem = data.value?.[0]?.value?.[0] || data.value?.[0];
                const taxRateDecimal = firstItem?.TaxRateDecimal;
                const conditionRateRatio = firstItem?.ConditionRateRatio;
                console.log(`[TaxRate] TaxRateDecimal: ${taxRateDecimal}, ConditionRateRatio: ${conditionRateRatio}`);
                if (typeof taxRateDecimal === 'number' && !isNaN(taxRateDecimal) && taxRateDecimal > 0) {
                    console.log(`[TaxRate] PO ${purchaseOrder}: ${(taxRateDecimal * 100).toFixed(2)}%`);
                    return taxRateDecimal;
                }
                console.warn(`[TaxRate] Fallback a 16% para PO ${purchaseOrder}`);
                return 0.16;
            } catch (err) {
                console.error(`[TaxRate] Error para PO ${purchaseOrder}: ${err.message}`);
                return 0.16;
            }
        },

        // ===Subida a MIRO con validación de tolerancia ===
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
                        XML: datosCFDI.XML,
                        RetencionesConCodigos: datosCFDI.RetencionesConCodigos && datosCFDI.RetencionesConCodigos.length > 0
                            ? JSON.stringify(datosCFDI.RetencionesConCodigos)
                            : null
                    }
                };

                console.log('[Debug] RetencionesConCodigos:', {
                    tiene: !!datosCFDI.RetencionesConCodigos,
                    longitud: datosCFDI.RetencionesConCodigos?.length,
                    serializado: typeof payload.CFDIData.RetencionesConCodigos
                });

                // === Endpoint de notas de crédito ===
                const res = await fetch("/odata/v4/credit-notes-reception/CreateSupplierInvoiceFromList", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Accept": "application/json" },
                    body: JSON.stringify(payload),
                    credentials: "include"
                });

                if (!res.ok) {
                    const errText = await res.text();
                    const userMessage = this._formatErrorMessage(errText, datosCFDI.CURRENCY);
                    sap.m.MessageBox.warning(userMessage);
                    BusyIndicator.hide();
                    return;
                }

                const data = await res.json();

                // === Adjuntar PDF y XML ===
                const [oMessagePDF, oMessageXML] = await Promise.allSettled([
                    this.postLogAttachmentPDF(pdfFile, data.SupplierInvoice, datosCFDI.SUPPLIER, sInvoiceStatus)
                        .catch(err => ({ message: `PDF: ${err.message}`, success: false })),
                    this.postLogAttachmentXML(xmlFile, data.SupplierInvoice, datosCFDI.SUPPLIER, sInvoiceStatus)
                        .catch(err => ({ message: `XML: ${err.message}`, success: false }))
                ]);

                const aResults = [
                    {
                        label: "Nota de crédito a MIRO",
                        message: `Nota de crédito enviada a MIRO. ID: ${data.SupplierInvoice || "sin ID"}`,
                        icon: "sap-icon://accounting-document-verification",
                        success: true
                    },
                    {
                        label: "Documento PDF",
                        message: oMessagePDF.value?.message || oMessagePDF.reason?.message,
                        icon: "sap-icon://pdf-attachment",
                        success: oMessagePDF.status === 'fulfilled' && oMessagePDF.value?.success
                    },
                    {
                        label: "Documento XML",
                        message: oMessageXML.value?.message || oMessageXML.reason?.message,
                        icon: "sap-icon://excel-attachment",
                        success: oMessageXML.status === 'fulfilled' && oMessageXML.value?.success
                    }
                ];

                this._showResultDialog(aResults);
                BusyIndicator.hide();

                // === Cerrar diálogo de resumen ===
                if (this._oResumenDialog) {
                    this._oResumenDialog.close();
                }
            } catch (err) {
                console.error("[_subirAFI] Error:", err);
                MessageBox.warning("Error al subir nota de crédito a MIRO:\n" + (err.message || "Error desconocido"));
                BusyIndicator.hide();
            }
        },

        // ===Diálogo de resultados estructurado ===
        _showResultDialog: function (aResults) {
            const oController = this; // === Guardar referencia al controller ===

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
                    // === ACTUALIZAR TABLA AL CERRAR ===
                    if (oController) {
                        oController.getCreditNotesReceipt();
                        console.log("[_showResultDialog] Tabla recargada al cerrar dialog");
                    }
                    oDialog.destroy();
                }
            }).addStyleClass("sapUiResponsivePadding--content sapUiResponsivePadding--header sapUiResponsivePadding--footer sapUiResponsivePadding--subHeader");

            oDialog.open();
        },

        _eliminarFactura: function (folio) {
            MessageBox.confirm(`¿Deseas eliminar la nota de crédito ${folio}?`, {
                onClose: (oAction) => {
                    if (oAction === MessageBox.Action.OK) {
                        sap.m.MessageToast.show(`Nota de crédito ${folio} eliminada`);
                    }
                }
            });
        },

        // ===Confirmación de desviación con detalles ===
        _getDeviationConfirmation: function (aDeviations, nMaxQntyTolerance, nMinQntyTolerance) {
            const firstDeviation = aDeviations[0];
            const nDeviation = typeof firstDeviation === 'object' ? firstDeviation.deviation : firstDeviation;
            const po = typeof firstDeviation === 'object' ? firstDeviation.po : null;
            const items = typeof firstDeviation === 'object' ? firstDeviation.items : null;
            const expected = typeof firstDeviation === 'object' ? firstDeviation.expected : null;
            const received = typeof firstDeviation === 'object' ? firstDeviation.received : null;
            const totalEffectiveAmount = typeof firstDeviation === 'object' ? firstDeviation.totalEffectiveAmount : null;

            const isAboveMax = nDeviation > nMaxQntyTolerance;
            const isBelowMin = nMinQntyTolerance !== undefined && nDeviation < nMinQntyTolerance;

            let sMessage = '';
            const itemsText = items ? ` (Items: ${items.join(', ')})` : '';

            if (isAboveMax) {
                sMessage = po
                    ? `La diferencia de ${nDeviation.toFixed(2)} supera la desviación máxima ${nMaxQntyTolerance}\n` +
                    `PO: ${po}${itemsText}\n` +
                    `Total OC (sin impuestos): ${totalEffectiveAmount?.toFixed(2) || 'N/A'}\n` +
                    `Esperado (con impuestos): ${expected?.toFixed(2)}\n` +
                    `Recibido en nota de crédito: ${received?.toFixed(2)}`
                    : `La diferencia ${nDeviation?.toFixed(2) || nDeviation} supera la desviación máxima ${nMaxQntyTolerance}`;
            } else if (isBelowMin) {
                sMessage = po
                    ? `La diferencia de ${nDeviation.toFixed(2)} está por debajo de la desviación mínima ${nMinQntyTolerance}\n` +
                    `PO: ${po}${itemsText}\n` +
                    `Total OC (sin impuestos): ${totalEffectiveAmount?.toFixed(2) || 'N/A'}\n` +
                    `Esperado (con impuestos): ${expected?.toFixed(2)}\n` +
                    `Recibido en nota de crédito: ${received?.toFixed(2)}`
                    : `La diferencia ${nDeviation?.toFixed(2) || nDeviation} está por debajo de la desviación mínima ${nMinQntyTolerance}`;
            } else {
                sMessage = `La diferencia ${nDeviation?.toFixed(2) || nDeviation} está fuera del rango aceptable`;
            }

            const pConfirmation = new Promise((resolve) => {
                const oDialog = new Dialog({
                    type: "Message",
                    title: isAboveMax ? "Desviación Máxima" : "Desviación Mínima",
                    content: new Text({ text: sMessage }), beginButton: new Button({
                        type: "Emphasized",
                        text: "Enviar con desviación",
                        press: function () {
                            resolve("Enviar");
                            oDialog.close();
                        }.bind(this)
                    }),
                    endButton: new Button({
                        text: "Cargar otra nota de crédito",
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

        // ===Formato de errores mejorado ===
        _formatErrorMessage: function (errText, currency) {
            // === 1. Intentar parsear JSON si viene como string ===
            let errorObj;
            try {
                errorObj = typeof errText === 'string' ? JSON.parse(errText) : errText;
            } catch (e) {
                errorObj = { error: { message: errText } };
            }

            // Extraer mensaje del error
            const message = errorObj.error?.message ||
                errorObj.message ||
                (typeof errText === 'string' ? errText : JSON.stringify(errText));

            const cleanText = message.replace(/\n/g, " ").trim();

            // === 2. NUEVO: Diferencia de montos ===
            const montoDiffMatch = cleanText.match(/Diferencia de montos:\s*([\d.,]+)/);
            if (montoDiffMatch) {
                const montoDiferencia = montoDiffMatch[1];
                return `Diferencia de Montos Detectada\n\n` +
                    `La suma de los importes seleccionados (${currency} ${montoDiferencia}) ` +
                    `no coincide con el subtotal de la nota de crédito.\n\n` +
                    `Posibles causas:\n` +
                    `• Seleccionaste posiciones de pedido con montos diferentes a la nota\n` +
                    `• La nota de crédito tiene un monto incorrecto\n\n` +
                    `Recomendación:\n` +
                    `Verifica que los documentos seleccionados en la tabla correspondan ` +
                    `exactamente al monto total de la nota de crédito.`;
            }

            // === 3. Duplicado de documento contable ===
            let duplicateMatch = cleanText.match(/potential duplicate exists.*?acc doc (\d+) (\d+)/);
            if (duplicateMatch) {
                const accDoc = duplicateMatch[1];
                const year = duplicateMatch[2];
                return `Ya existe una nota contabilizada para este documento de referencia.\n` +
                    `Documento contable existente: ${accDoc} (${year})\n\n` +
                    `Posibles causas:\n` +
                    `• Esta posición de pedido ya fue facturada previamente\n` +
                    `Verifique:\n` +
                    `1. Las posiciones de pedido seleccionadas en la tabla\n` +
                    `2. Si necesita facturar una posición diferente, selecciónela específicamente`;
            }

            // === 4. Error de retenciones exceden monto ===
            if (cleanText.includes("monto total de retenciones") &&
                cleanText.includes("excede el monto de los ítems")) {
                const montoRet = cleanText.match(/\(\$([\d.,]+)\)/)?.[1] || "N/A";
                const montoItems = cleanText.match(/ítems \(\$([\d.,]+)\)/)?.[1] || "N/A";
                return "Retenciones Exceden el Monto\n\n" +
                    "El monto de retención configurado excede el valor de la nota de crédito.\n\n" +
                    `• Monto de retenciones: $${montoRet}\n` +
                    `• Monto de ítems seleccionados: $${montoItems}\n\n` +
                    `Contacte al equipo de finanzas para revisar la configuración.`;
            }

            // === 5. Balance contable ===
            const balanceMatch = cleanText.match(/Balance not zero.*?debits:\s([\d.,]+)\s+credits:\s([\d.,]+)/);
            if (balanceMatch) {
                const debits = parseFloat(balanceMatch[1].replace(/,/g, ""));
                const credits = parseFloat(balanceMatch[2].replace(/,/g, ""));
                const diff = (debits - credits).toFixed(2);
                return `El balance contable no cuadra.\n\n` +
                    `Débitos: ${debits.toLocaleString("es-MX")} ${currency}\n` +
                    `Créditos: ${credits.toLocaleString("es-MX")} ${currency}\n` +
                    `Diferencia: ${diff.toLocaleString("es-MX")} ${currency}\n\n` +
                    `Verifique los montos de las partidas.`;
            }

            // === 6. Duplicado de factura ===
            duplicateMatch = cleanText.match(/potential duplicate exists \(inv\. (\d+) (\d{4})\)/);
            if (duplicateMatch) {
                const invoiceNumber = duplicateMatch[1];
                const year = duplicateMatch[2];
                return `La nota no se creó automáticamente porque ya existe un posible duplicado.\n\n` +
                    `Nota existente: ${invoiceNumber} (${year}).\n\n` +
                    `Verifique si ya procesó esta nota de crédito anteriormente.`;
            }

            // === 7. TaxCode faltante ===
            if (cleanText.includes("Enter a tax code in item") || cleanText.includes("Falta TaxCode")) {
                return "Código de Impuesto Faltante\n\n" +
                    "La orden de compra seleccionada no tiene código de impuesto configurado.\n\n" +
                    `PO afectada: ${cleanText.match(/PO:\s*(\d+)/)?.[1] || 'No identificada'}\n\n` +
                    `Contacte al equipo de finanzas para corregirlo en S/4HANA.`;
            }

            // === 8. Internal Server Error ===
            if (cleanText.includes("Internal Server Error")) {
                return "Error Interno del Servidor\n\n" +
                    "Ocurrió un error interno en el servidor.\n\n" +
                    `Detalles: ${cleanText}\n\n` +
                    `Intente nuevamente o contacte al área de soporte técnico.`;
            }

            // === 9. Otros errores - mensaje genérico pero limpio ===
            return `Error al registrar la nota de crédito\n\n` +
                `Detalles: ${cleanText}\n\n` +
                `Si el problema persiste, contacte al área de soporte.`;
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
                    sap.m.MessageBox.warning(
                        `El balance contable no cuadra.\n` +
                        `Débitos: ${debits.toLocaleString("es-MX")} ${CURRENCY}\n` +
                        `Créditos: ${credits.toLocaleString("es-MX")} ${CURRENCY}\n` +
                        `Diferencia: ${diff.toLocaleString("es-MX")} ${CURRENCY}`
                    );
                    return;
                }
            }

            if (errText.includes("Enter a tax code in item") || errText.includes("Falta TaxCode")) {
                sap.m.MessageBox.warning(
                    "La orden de compra seleccionada no tiene código de impuesto configurado.\n" +
                    "Contacte al equipo de finanzas para corregirlo en S/4HANA."
                );
                return;
            }

            if (errText.includes("Internal Server Error")) {
                sap.m.MessageBox.error(
                    "Ocurrió un error interno en el servidor. Intente nuevamente o contacte al área de soporte."
                );
                return;
            }

            sap.m.MessageBox.error("Error al registrar la nota de crédito:\n" + errText);
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

        // ===Utilidad para convertir archivos a Base64 ===
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
        },

        formatDateForFrontEnd: function (date, odataVersion = "V2") {
            if (!date) return null;
            const d = new Date(date);
            return odataVersion === "V2"
                ? `/Date(${d.getTime()})/`
                : d.toISOString();
        },

        formatDateForBackend: function (date) {
            if (!date) return null;
            const d = new Date(date);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        },

        // Propiedad para almacenar archivos de aclaración
        _aclaracionFiles: [],
        _oEmptyFilesMessage: null,

        aclaracionButton: function () {
            this._mostrarDialogoAclaracion();
        },

        _mostrarDialogoAclaracion: function () {
            const oController = this;

            // Resetear archivos
            this._aclaracionFiles = [];

            // Label de anexos
            const oAnexosLabel = new sap.m.Label({
                text: "Anexos (0)",
                design: "Bold"
            });

            // Input file HTML nativo (oculto)
            const oFileInput = document.createElement("input");
            oFileInput.type = "file";
            oFileInput.multiple = true;
            oFileInput.accept = ".pdf,.png,.jpg,.jpeg";
            oFileInput.style.display = "none";

            oFileInput.addEventListener("change", function () {
                const aNewFiles = Array.from(oFileInput.files);
                const aCurrentFiles = oController._aclaracionFiles;

                if (aNewFiles.length === 0) return;

                // Validar máximo 5 archivos
                if (aCurrentFiles.length + aNewFiles.length > 5) {
                    sap.m.MessageBox.warning(
                        `Solo se permiten máximo 5 archivos. Actualmente tiene ${aCurrentFiles.length} archivo(s).`
                    );
                    oFileInput.value = "";
                    return;
                }

                // Validar cada archivo
                for (const oFile of aNewFiles) {
                    // Validar tamaño (10 MB)
                    if (oFile.size > 10 * 1024 * 1024) {
                        sap.m.MessageBox.warning(
                            `El archivo "${oFile.name}" excede el límite de 10 MB.`
                        );
                        continue;
                    }

                    // Validar tipo
                    const sFileType = oFile.type;
                    const sValidTypes = ["application/pdf", "image/png", "image/jpeg"];
                    if (!sValidTypes.includes(sFileType)) {
                        sap.m.MessageBox.warning(
                            `El archivo "${oFile.name}" no es válido. Solo se permiten PDF, PNG y JPG.`
                        );
                        continue;
                    }

                    // Agregar archivo
                    oController._aclaracionFiles.push({
                        file: oFile,
                        name: oFile.name,
                        size: oFile.size,
                        type: oFile.type
                    });
                }

                // Limpiar el input para permitir volver a seleccionar
                oFileInput.value = "";

                // Actualizar UI
                oController._actualizarListaAnexos(oAclaracionList, oAnexosLabel);
            });

            // Botón Agregar - Dispara el input file
            const oBtnAgregar = new sap.m.Button({
                text: "Agregar",
                press: function () {
                    oFileInput.click();
                }
            });

            // Lista de archivos
            const oAclaracionList = new sap.m.List({
                id: this.createId("aclaracionList"),
                showSeparators: "Inner",
                items: []
            });

            // TextArea para comentario
            const oCommentArea = new sap.m.TextArea({
                id: this.createId("aclaracionComment"),
                placeholder: "Ingrese un comentario descriptivo para la aclaración.",
                rows: 4,
                width: "100%",
                value: ""
            });

            // Label de contacto
            const oContactLabel = new sap.m.Label({
                text: "Contacto: ()"
            });

            // Mensaje cuando no hay archivos
            const oEmptyMessage = new sap.m.VBox({
                alignItems: "Center",
                items: [
                    new sap.ui.core.Icon({
                        src: "sap-icon://document",
                        size: "4rem",
                        color: "#a0a0a0"
                    }),
                    new sap.m.Text({
                        text: "No se ha cargado ningún archivo"
                    }).addStyleClass("sapUiSmallMarginTopBottom"),
                    new sap.m.Text({
                        text: "Máximo 5 archivos/10 Mb. Formatos válidos: PDF, PNG y JPG.",
                        textAlign: "Center"
                    }).addStyleClass("sapUiTinyMarginTop")
                ],
                visible: true
            });
            this._oEmptyFilesMessage = oEmptyMessage;

            // Crear diálogo
            const oDialog = new sap.m.Dialog({
                title: "Cargar archivos para aclaración",
                contentWidth: "600px",
                content: [
                    new sap.m.VBox({
                        width: "100%",
                        alignItems: "Center",
                        items: [
                            new sap.m.HBox({
                                width: "100%",
                                justifyContent: "SpaceBetween",
                                alignItems: "Center",
                                items: [
                                    oAnexosLabel,
                                    oBtnAgregar
                                ]
                            }).addStyleClass("sapUiSmallMarginBottom"),

                            oEmptyMessage.addStyleClass("sapUiMediumMarginTopBottom"),
                            oAclaracionList.addStyleClass("sapUiSmallMarginTopBottom"),
                            oContactLabel.addStyleClass("sapUiSmallMarginTopBottom"),
                            oCommentArea
                        ]
                    })
                ],
                beginButton: new sap.m.Button({
                    text: "Enviar",
                    type: "Emphasized",
                    press: async function () {
                        // Validar comentario obligatorio
                        const sComment = oCommentArea.getValue().trim();
                        if (!sComment) {
                            sap.m.MessageBox.error(
                                "El comentario es obligatorio. Por favor ingrese una descripción de la aclaración.",
                                { title: "Comentario requerido" }
                            );
                            return;
                        }

                        // Validar que haya al menos un archivo
                        if (oController._aclaracionFiles.length === 0) {
                            sap.m.MessageBox.warning(
                                "Debe cargar al menos un archivo.",
                                { title: "Archivos requeridos" }
                            );
                            return;
                        }

                        // Enviar aclaración
                        await oController._enviarAclaracion(sComment, oDialog);
                    }
                }),
                endButton: new sap.m.Button({
                    text: "Cerrar",
                    press: function () {
                        oDialog.close();
                    }
                }),
                afterClose: function () {
                    oDialog.destroy();
                    oController._aclaracionFiles = [];
                }
            });

            // Guardar referencia y abrir
            this._oAclaracionDialog = oDialog;
            oDialog.open();

            // Agregar el input file al body del documento (fuera del diálogo)
            document.body.appendChild(oFileInput);
        },

        _actualizarListaAnexos: function (oList, oLabel) {
            const aFiles = this._aclaracionFiles;

            // Actualizar label
            oLabel.setText(`Anexos (${aFiles.length})`);

            // Mostrar/ocultar mensaje de vacío
            if (this._oEmptyFilesMessage) {
                this._oEmptyFilesMessage.setVisible(aFiles.length === 0);
            }

            // Limpiar lista
            oList.removeAllItems();

            // Agregar items
            aFiles.forEach((oFileData, nIndex) => {
                const sSizeKB = (oFileData.size / 1024).toFixed(1);

                oList.addItem(
                    new sap.m.CustomListItem({
                        content: [
                            new sap.m.HBox({
                                alignItems: "Center",
                                justifyContent: "SpaceBetween",
                                width: "100%",
                                items: [
                                    new sap.m.HBox({
                                        alignItems: "Center",
                                        items: [
                                            new sap.ui.core.Icon({
                                                src: this._getIconForFileType(oFileData.type),
                                                size: "2rem",
                                                color: "#0070d2"
                                            }).addStyleClass("sapUiSmallMarginEnd"),
                                            new sap.m.VBox({
                                                items: [
                                                    new sap.m.Text({
                                                        text: oFileData.name,
                                                        emphasizing: true
                                                    }),
                                                    new sap.m.Text({
                                                        text: `${sSizeKB} KB`,
                                                        description: true
                                                    })
                                                ]
                                            })
                                        ]
                                    }),
                                    new sap.ui.core.Icon({
                                        src: "sap-icon://decline",
                                        color: "#ff0000",
                                        press: function () {
                                            this._aclaracionFiles.splice(nIndex, 1);
                                            this._actualizarListaAnexos(oList, oLabel);
                                        }.bind(this)
                                    })
                                ]
                            })
                        ]
                    })
                );
            });

            // Mostrar lista si hay archivos
            oList.setVisible(aFiles.length > 0);
        },

        _getIconForFileType: function (sType) {
            if (sType === "application/pdf") {
                return "sap-icon://pdf-attachment";
            } else if (sType.includes("image")) {
                return "sap-icon://image";
            }
            return "sap-icon://document";
        },

        _enviarAclaracion: async function (sComment, oDialog) {
            console.log("Comentario:", sComment);
            console.log("Archivos:", this._aclaracionFiles);

            sap.m.MessageBox.success(
                "Función en desarrollo. Archivos listos para enviar.",
                {
                    title: "Información",
                    onClose: function () {
                        oDialog.close();
                    }
                }
            );
        }

    });
});