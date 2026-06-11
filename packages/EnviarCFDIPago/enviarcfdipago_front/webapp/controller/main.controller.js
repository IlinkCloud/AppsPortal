sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/odata/v4/ODataModel",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/BusyIndicator",
    "sap/m/MessageBox",
    "sap/ui/core/format/DateFormat",
    "sap/ui/unified/FileUploader",
    "sap/m/Dialog",
    "sap/m/Text",
    "sap/m/Button",
    "sap/m/VBox",
    "sap/m/ObjectStatus",
    "sap/m/Label",
    "sap/m/StandardListItem",
    "sap/m/List",
    "sap/ui/core/Icon",
    "sap/m/PDFViewer",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], (Controller, ODataModel, JSONModel, BusyIndicator, MessageBox, DateFormat, FileUploader, Dialog, Text, Button, VBox, ObjectStatus, Label, StandardListItem, List, Icon, PDFViewer, MessageToast, Filter, FilterOperator) => {
    "use strict";
    return Controller.extend("enviarcfdipagofront.controller.main", {
        onInit() {
            this._oAclaModel = new ODataModel({
                serviceUrl: "/odata/v4/aclaraciones/",
                synchronizationMode: "None"
            });
            this._setDefaultDates();
            this.getPaymentComplements();
        },

        _setDefaultDates: function () {
            const oToday = new Date();
            const oStartOfYear = new Date(oToday.getFullYear(), 0, 1);
            const oStartDatePicker = this.byId("startDatePicker");
            const oEndDatePicker = this.byId("endDatePicker");
            if (oStartDatePicker) oStartDatePicker.setDateValue(oStartOfYear);
            if (oEndDatePicker) oEndDatePicker.setDateValue(oToday);
        },

        getPaymentComplements() {
            BusyIndicator.show(100);
            const oStart = this.byId("startDatePicker")?.getDateValue();
            const oEnd = this.byId("endDatePicker")?.getDateValue();
            const formatDate = (d) => d ? d.toISOString().split('T')[0] : null;
            let url = `/odata/v4/cfdipayment/ReadPaymentComplement`;
            const params = [];
            if (formatDate(oStart)) params.push(`FromDate=${formatDate(oStart)}`);
            if (formatDate(oEnd)) params.push(`ToDate=${formatDate(oEnd)}`);
            if (params.length > 0) url += `?${params.join('&')}`;
            console.log("[getPaymentComplements] URL:", url);
            fetch(url, { method: "GET", headers: { "Accept": "application/json" }, credentials: "include" })
                .then(res => {
                    return res.ok ? res.json() : res.text().then(t => { throw new Error(t); });
                })
                .then(data => {
                    const aData = data.value || [];
                    console.log("[getPaymentComplements] Registros cargados:", aData.length);
                    let oModel = this.getView().getModel("PCModel");
                    if (!oModel) {
                        oModel = new JSONModel();
                        this.getView().setModel(oModel, "PCModel");
                    }
                    oModel.setProperty("/paymentComplements", aData);
                    BusyIndicator.hide();
                })
                .catch(err => {
                    console.error("[getPaymentComplements] Error:", err);
                    MessageBox.error("Error al cargar complementos de pago");
                    BusyIndicator.hide();
                });
        },

        onSearch(oEvent) {
            const sQuery = oEvent.getParameter("query");
            const sSelectedKey = this.byId("selectFilter").getSelectedKey();
            const oTable = this.byId("complPagoTbl");
            const oBinding = oTable.getBinding("items");
            let aFilters = [];
            if (sQuery) {
                aFilters.push(new Filter(sSelectedKey, FilterOperator.Contains, sQuery));
            }
            oBinding.filter(aFilters);
        },

        onUpload: function () {
            const oTable = this.byId("complPagoTbl");
            const aSelected = oTable.getSelectedItems();
            if (aSelected.length === 0) {
                MessageBox.warning("Debes seleccionar un documento en la tabla antes de subir archivos.");
                return;
            }
            this._showUploadFileDialog(aSelected);
        },

        onChangeDate: function () {
            console.log("[onChangeDate] Fechas cambiadas, recargando datos del backend...");
            const oStart = this.byId("startDatePicker")?.getDateValue();
            const oEnd = this.byId("endDatePicker")?.getDateValue();
            console.log("[onChangeDate] Nueva fecha inicio:", oStart);
            console.log("[onChangeDate] Nueva fecha fin:", oEnd);
            this.getPaymentComplements();
        },

        _showUploadFileDialog(aSelected) {
            const oController = this;
            let aFiles;
            if (!this._oUploadDialog) {
                const oFileUploader = new FileUploader({
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
                                MessageBox.warning(`El archivo "${file.name}" excede el límite de 2 Mb.`);
                                return;
                            }
                            if (!(file.type === "application/pdf" || file.type === "text/xml" || file.type === "application/xml")) {
                                MessageBox.warning(`El archivo "${file.name}" no es válido. Solo se permiten PDF o XML.`);
                                return;
                            }
                            oFileList.addItem(new StandardListItem({ title: file.name }));
                        });
                    }
                });
                const oAnexosLabel = new Label({
                    text: "Anexos (0)",
                    design: "Bold",
                    width: "100%",
                    textAlign: "Center"
                }).addStyleClass("sapUiTinyMarginTop");
                const oFileList = new List({
                    headerText: "Archivos seleccionados",
                    visible: true,
                    items: []
                });
                this._oUploadDialog = new Dialog({
                    title: "Cargar Archivos CFDI",
                    contentWidth: "550px",
                    contentHeight: "300px",
                    verticalScrolling: true,
                    horizontalScrolling: false,
                    content: [
                        new VBox({
                            alignItems: "Center",
                            justifyContent: "Center",
                            width: "100%",
                            items: [
                                oAnexosLabel,
                                new Icon({ src: "sap-icon://document", size: "4rem" }),
                                new Label({ text: "2 Mb", design: "Bold" }),
                                new Text({ text: "Selecciona o Arrastra el XML y PDF", textAlign: "Center" }).addStyleClass("sapUiSmallMarginTop"),
                                oFileUploader,
                                oFileList.addStyleClass("sapUiSmallMarginTop")
                            ]
                        })
                    ],
                    beginButton: new Button({
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
                            for (const file of aFiles) {
                                const tipo = file.type;
                                const oContext = aSelected[0].getBindingContext("PCModel");
                                const oData = oContext.getObject();
                                const proveedorId = oData.Supplier;
                                const sociedadId = oData.CompanyCode;
                                const fechaFactura = oData.PaymentDate?.split('T')[0];
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
                                            tipoDocumento: "P",
                                            fechaFactura,
                                            paymentDocument: oData.PaymentDocument,
                                            PaymentDate: oData.PaymentDate?.split('T')[0]
                                        };
                                        try {
                                            const validacionPAC = await oController.getValidacionPAC();
                                            let urlValidacion;
                                            if (validacionPAC) {
                                                urlValidacion = "/odata/v4/cfdipayment/ValidarFacturaReglasPac";
                                                console.log("[Validación] Usando ValidarFacturaReglasPac (validación PAC activada)");
                                            } else {
                                                urlValidacion = "/odata/v4/cfdipayment/ValidarFactura";
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
                                                sap.m.MessageBox.warning("Error al validar complemento de pago:\n" + errText);
                                                return;
                                            }
                                            const data = await res.json();
                                            if (data.valido) {
                                                if (data.datos) {
                                                    const oContext = aSelected[0].getBindingContext("PCModel");
                                                    const oData = oContext.getObject();
                                                    data.datos.Items = [{
                                                        MaterialDocument: oData.MaterialDocument || "",
                                                        MaterialDocumentItem: oData.MaterialDocumentItem || "1",
                                                        PurchaseOrder: oData.PurchaseOrder,
                                                        PurchaseOrderItem: String(oData.PurchaseOrderItem),
                                                        Supplier: oData.Supplier || data.datos.LIFNR,
                                                        Plant: oData.Plant || data.datos.BUKRS,
                                                        QuantityInEntryUnit: oData.QuantityInEntryUnit || 1
                                                    }];
                                                    data.datos.ReferenceDocument = oData.ReferenceDocument;
                                                    data.datos.FixedUUID = data.datos.Comprobante?.['cfdi:CfdiRelacionados']?.['cfdi:CfdiRelacionado']?.['@_UUID'] || null;
                                                    oController._mostrarResumenCFDI(data.datos, pdfFile, xmlFile);
                                                }
                                            } else {
                                                const errores = data.errores || [data.mensaje] || ["Factura inválida"];
                                                const sDuplicatedMsg = errores.find(sError => sError.includes("está repetido"));
                                                if (sDuplicatedMsg) {
                                                    oController._showDuplicatedUUIDMessage(sDuplicatedMsg, aSelected);
                                                } else {
                                                    MessageBox.warning("Factura inválida:\n" + errores.join("\n"));
                                                }
                                            }
                                            BusyIndicator.hide();
                                        } catch (err) {
                                            MessageBox.warning("Error al validar factura:\n" + err.message);
                                            BusyIndicator.hide();
                                        }
                                    };
                                    reader.readAsBinaryString(file);
                                }
                            }
                            oController._oUploadDialog.close();
                        }
                    }),
                    endButton: new Button({
                        text: "Cerrar",
                        type: "Reject",
                        press: function () {
                            oController._oUploadDialog.close();
                        }
                    }),
                    afterClose: function () {
                        oController._oUploadDialog.destroy();
                        oController._oUploadDialog = null;
                    }
                });
            }
            this._oUploadDialog.open();
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
                                resolve(false);
                            }
                        } else {
                            console.log("[getValidacionPAC] No se encontraron parámetros, usando valor por defecto: false");
                            resolve(false);
                        }
                    })
                    .catch(err => {
                        console.error("[getValidacionPAC] Error:", err);
                        resolve(false);
                    });
            });
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

        _mostrarResumenCFDI: function (datosCFDI, pdfFile, xmlFile) {
            const oController = this;
            const oDialog = new sap.m.Dialog({
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
                                                tooltip: "Subir a Base de Datos",
                                                type: "Emphasized",
                                                press: async () => {
                                                    await oController._subirAFI(datosCFDI, pdfFile, xmlFile);
                                                    oDialog.close();
                                                }
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
                }
            });
            oDialog.open();
        },

        _verPDF: function (oFile) {
            if (!oFile) {
                MessageToast.show("No hay archivo para visualizar");
                return;
            }
            if (oFile.type !== "application/pdf") {
                MessageToast.show("El archivo seleccionado no es un PDF válido");
                return;
            }
            const sFileUrl = URL.createObjectURL(oFile);
            jQuery.sap.addUrlWhitelist("blob");
            if (!this._pdfViewer) {
                this._pdfViewer = new PDFViewer({
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

        _subirAFI: async function (datosCFDI, pdfFile, xmlFile) {

            BusyIndicator.show(100);
            try {
                const oTable = this.getView().byId("complPagoTbl");
                const aSelected = oTable.getSelectedItems();
                const oElement = aSelected[0];
                const oContext = oElement.getBindingContext("PCModel");
                const oData = oContext.getObject();

                const payload = {
                    data: {
                        "DocumentNumber": oData.PaymentDocument,
                        "Exercise": oData.FiscalYear,
                        "Society": oData.CompanyCode,
                        "Status": oData.Status,
                        "Uuid": datosCFDI.UUID || "",
                        "Folio": datosCFDI.FOLIO || "",
                        "Serie": datosCFDI.SERIE || "",
                        "Supplier": oData.Supplier,
                        "Rfc": datosCFDI.RFC || "",
                        "PaymentDate": oData.PaymentDate?.split('T')[0] || "",
                        "Currency": datosCFDI.CURRENCY || "MXN",
                        "Total": String(datosCFDI.TOTAL || 0),
                        "Iva": String(datosCFDI.TOTAL_IMPUESTOSTRAS || 0),
                        "FormOfPayment": datosCFDI.FORM_OF_PAYMENT || "",
                        "RfcOrd": datosCFDI.RFC_EMISOR_CTA_ORD || "",
                        "Bank": datosCFDI.NOM_BANCO_ORD_EXT || "",
                        "OrdAccount": datosCFDI.CTA_ORDENANTE || "",
                        "BenAccount": datosCFDI.CTA_BENEFICIARIO || "",
                        "RfcBen": datosCFDI.RFC_EMISOR_CTA_BEN || "",
                        "PaymentOperationNumber": datosCFDI.NUM_OPERACION || "",
                        "XmlName": xmlFile ? xmlFile.name : "",
                        "PdfName": pdfFile ? pdfFile.name : "",
                    }
                };

                console.log("[Payload]", payload);

                const res = await fetch("/odata/v4/cfdipayment/Upload", {
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
                    MessageBox.error("Error al subir a Complemento de Pago:\n" + errText);
                    BusyIndicator.hide();
                    return;
                }

                const data = await res.json();
                console.log("[_subirAFI] Respuesta Upload:", data);

                let oMessagePDF = { success: false, message: "PDF no adjuntado" };
                if (pdfFile) {
                    try {
                        const pdfBase64 = await this._fileToBase64(pdfFile);
                        const pdfPayload = {
                            documentId: oData.PaymentDocument,
                            CompanyCode: oData.CompanyCode,
                            FiscalYear: oData.FiscalYear,
                            supplier: oData.Supplier,
                            pdfBase64: pdfBase64
                        };
                        const pdfRes = await fetch("/odata/v4/cfdipayment/AdjuntarFacturaPDF", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Accept": "application/json"
                            },
                            body: JSON.stringify(pdfPayload),
                            credentials: "include"
                        });
                        if (pdfRes.ok) {
                            const pdfData = await pdfRes.json();
                            oMessagePDF = {
                                success: true,
                                message: pdfData.mensaje || "PDF adjuntado correctamente"
                            };
                        } else {
                            oMessagePDF = { success: false, message: "Error al adjuntar PDF" };
                        }
                    } catch (pdfErr) {
                        console.error("[_subirAFI] Error adjuntar PDF:", pdfErr);
                        oMessagePDF = { success: false, message: "Error al adjuntar PDF: " + pdfErr.message };
                    }
                }

                let oMessageXML = { success: false, message: "XML no adjuntado" };
                if (xmlFile) {
                    try {
                        const xmlBase64 = await this._fileToBase64(xmlFile);
                        const xmlPayload = {
                            documentId: oData.PaymentDocument,
                            CompanyCode: oData.CompanyCode,
                            FiscalYear: oData.FiscalYear,
                            supplier: oData.Supplier,
                            xmlBase64: xmlBase64
                        };
                        const xmlRes = await fetch("/odata/v4/cfdipayment/AdjuntarFacturaXML", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Accept": "application/json"
                            },
                            body: JSON.stringify(xmlPayload),
                            credentials: "include"
                        });
                        if (xmlRes.ok) {
                            const xmlData = await xmlRes.json();
                            oMessageXML = {
                                success: true,
                                message: xmlData.mensaje || "XML adjuntado correctamente"
                            };
                        } else {
                            oMessageXML = { success: false, message: "Error al adjuntar XML" };
                        }
                    } catch (xmlErr) {
                        console.error("[_subirAFI] Error adjuntar XML:", xmlErr);
                        oMessageXML = { success: false, message: "Error al adjuntar XML: " + xmlErr.message };
                    }
                }

                const aResults = [
                    {
                        label: "Complemento a Base de Datos",
                        message: `Complemento cargado exitosamente`,
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
                    },
                ];

                this._showResultDialog(aResults);
                BusyIndicator.hide();

            } catch (err) {
                console.error("[_subirAFI] Error:", err);
                MessageBox.error("Error al cargar complemento: " + (err.message || "Error desconocido"));
                BusyIndicator.hide();
            }
        },

        onTableSelectionChange: function (oEvent) {
            if (this._isProcessingSelection) return;
            this._isProcessingSelection = true;

            // CORRECCIÓN: Usar el ID correcto de la tabla
            const oTable = this.byId("complPagoTbl");
            const aSelected = oTable.getSelectedItems();

            // Identificar items que NO deberían haber sido seleccionados
            const aInvalidSelection = aSelected.filter(item => {
                const ctx = item.getBindingContext("PCModel");
                if (!ctx) return false;
                const oData = ctx.getObject();
                // Marcar como inválidos si están en Lista Negra O bloqueados manualmente
                return oData.isBlackListed === true || oData.isUserBlocked === true;
            });

            if (aInvalidSelection.length > 0) {
                aInvalidSelection.forEach(item => oTable.setSelectedItem(item, false));

                // Mensaje diferenciado según el tipo de bloqueo
                const hasBlackList = aInvalidSelection.some(item =>
                    item.getBindingContext("PCModel").getObject().isBlackListed === true
                );
                const hasUserBlock = aInvalidSelection.some(item =>
                    item.getBindingContext("PCModel").getObject().isUserBlocked === true
                );

                let message = "";
                if (hasBlackList && hasUserBlock) {
                    message = "Hay proveedores en Lista Negra o bloqueados que no pueden ser seleccionados.";
                } else if (hasBlackList) {
                    message = "Este proveedor está en Lista Negra y no puede ser seleccionado.";
                } else if (hasUserBlock) {
                    message = "Este proveedor está bloqueado manualmente y no puede ser seleccionado.";
                }
                sap.m.MessageToast.show(message);
            }

            setTimeout(() => { this._isProcessingSelection = false; }, 0);
        },

        _showResultDialog: function (aResults) {
            const oController = this;
            const oVBox = new VBox({
                items: [
                    ...aResults.map(function (item) {
                        return new VBox({
                            items: [
                                new ObjectStatus({
                                    text: item.label,
                                    icon: item.icon,
                                    state: item.success ? "Success" : "Error"
                                }),
                                new Text({
                                    text: item.message
                                }).addStyleClass("sapUiSmallMarginBottom")
                            ]
                        }).addStyleClass("sapUiSmallMarginBottom");
                    })
                ]
            });
            const oDialog = new Dialog({
                title: "Resultados",
                content: oVBox,
                beginButton: new Button({
                    text: "Cerrar",
                    press: function () {
                        oDialog.close();
                    }
                }),
                afterClose: function () {
                    if (oController && typeof oController.getPaymentComplements === 'function') {
                        oController.getPaymentComplements();
                        console.log("[_showResultDialog] Tabla de pagos recargada al cerrar dialog");
                    }
                    oDialog.destroy();
                }
            }).addStyleClass("sapUiResponsivePadding--content sapUiResponsivePadding--header sapUiResponsivePadding--footer sapUiResponsivePadding--subHeader");
            oDialog.open();
        },

        _eliminarFactura: function (folio) {
            MessageBox.confirm(`¿Deseas eliminar la factura ${folio}?`, {
                onClose: (oAction) => {
                    if (oAction === MessageBox.Action.OK) {
                        MessageToast.show(`Factura ${folio} eliminada`);
                    }
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
        },

        formatDate(sDate) {
            if (!sDate) return "";
            const oDate = new Date(sDate);
            const oDateFormat = DateFormat.getInstance({
                style: "medium",
                UTC: true
            });
            return oDateFormat.format(oDate);
        },

        // Propiedad para almacenar archivos de aclaración
        _aclaracionFiles: [],
        _oEmptyFilesMessage: null,

        aclaracionButton: function () {
            const oTable = this.byId("complPagoTbl");
            const aSelectedItems = oTable.getSelectedItems();

            if (aSelectedItems.length === 0) {
                sap.m.MessageToast.show(
                    "Debe seleccionar al menos un documento."
                );
                return;
            }

            const oData = aSelectedItems[0]
                .getBindingContext("PCModel")
                .getObject();
            console.log("Documento seleccionado:", oData);

            this._mostrarDialogoAclaracion(oData);
        },

        _mostrarDialogoAclaracion: function (oData) {
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
            //const oContactLabel = new sap.m.Label({
            //    text: "Contacto: ()"
            //});

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
                            //oContactLabel.addStyleClass("sapUiSmallMarginTopBottom"),
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
                        await oController._enviarAclaracion(sComment, oDialog, oData);
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

        _enviarAclaracion: async function (sComment, oDialog, oData) {
            const aAttachments = [];

            console.log("Comentario:", sComment);
            console.log("Archivos:", this._aclaracionFiles);
            console.log("Datos del documento:", oData);

            for (const oFileInfo of this._aclaracionFiles) {

                const sBase64 = await this._fileToBase64(oFileInfo.file);

                aAttachments.push({
                    FileName: oFileInfo.name,
                    MimeType: oFileInfo.type,
                    Content: sBase64
                });
            }

            try {

                sap.ui.core.BusyIndicator.show(0);

                const oAction = this._oAclaModel.bindContext("/SaveAclaracion(...)");
                oAction.setParameter("Supplier", oData.Supplier);
                oAction.setParameter("DocumentNumber", oData.PaymentDocument);
                oAction.setParameter("DocumentType", "DC");
                oAction.setParameter("FiscalYear", oData.FiscalYear);
                oAction.setParameter("CompanyCode", oData.CompanyCode);
                oAction.setParameter("Message", sComment);
                oAction.setParameter("Attachments", aAttachments);
                await oAction.execute();

                sap.m.MessageBox.success(
                    "Aclaración enviada correctamente.",
                    {
                        title: "Éxito",
                        onClose: function () {
                            oDialog.close();
                        }
                    }
                );
            } catch (error) {

                console.error(error);
                sap.m.MessageBox.error("Error al guardar aclaración");

            } finally {
                sap.ui.core.BusyIndicator.hide();
            }
        }

    });
});