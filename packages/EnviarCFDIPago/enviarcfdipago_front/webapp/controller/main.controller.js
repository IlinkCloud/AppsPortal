sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/BusyIndicator",
    "sap/m/MessageBox",
    "sap/ui/core/format/DateFormat",
    "sap/ui/unified/FileUploader"
], (Controller, JSONModel, BusyIndicator, MessageBox, DateFormat, FileUploader) => {
    "use strict";

    return Controller.extend("enviarcfdipagofront.controller.main", {
        onInit() {
            this.getPaymentComplements();
        },

        getPaymentComplements() {
            BusyIndicator.show(100);
            let url = "/odata/v4/cfdipayment/ReadPaymentComplement()";

            fetch(url, { method: "GET", headers: { "Accept": "application/json" }, credentials: "include" })
                .then(res => {
                    return res.ok ? res.json() : res.text().then(t => { throw new Error(t); });
                })
                .then(data => {
                    const aData = data.value;

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
                aFilters.push(new sap.ui.model.Filter(sSelectedKey, sap.ui.model.FilterOperator.Contains, sQuery));
            }

            oBinding.filter(aFilters);
        },

        onUpload: function () {
            const oTable = this.byId("complPagoTbl");
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
                                            fechaFactura
                                        };

                                        try {
                                            // Consultar primero el valor de ValidacionPAC
                                            const validacionPAC = await oController.getValidacionPAC();

                                            let urlValidacion;
                                            if (validacionPAC) {
                                                // Si ValidacionPAC es true, usar ValidarCFDIListo
                                                urlValidacion = "/odata/v4/cfdipayment/ValidarFacturaReglasPac";
                                                console.log("[Validación] Usando ValidarCFDIListo (validación PAC activada)");
                                            } else {
                                                // Si ValidacionPAC es false, usar ValidarFactura
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
                }
            });

            oDialog.open();
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

        _subirAFI: async function (datosCFDI, pdfFile, xmlFile) {
            const oTable = this.getView().byId("complPagoTbl");
            const aSelected = oTable.getSelectedItems();
            const nMaxQntyTolerance = 150;
            const aDeviations = [];
            let sInvoiceStatus = "5";

            const oElement = aSelected[0];
            const oContext = oElement.getBindingContext("PCModel");
            const oData = oContext.getObject();
            const nTotalWithTax = oData.Ammount + (oData.Ammount * 0.16);

            if (nTotalWithTax + nMaxQntyTolerance < Number(datosCFDI.TOTAL)) {
                const nDeviation = Math.abs(nTotalWithTax - Number(datosCFDI.TOTAL));
                aDeviations.push(nDeviation);
            }

            BusyIndicator.show(100);
            try {
                const payload = {
                    data: {
                        "DocumentNumber": oData.PaymentDocument,
                        "Exercise": oData.FiscalYear,
                        "Society": oData.CompanyCode,
                        "BuyDocument": oData.BuyDocument,
                        "PositionNumber": oData.PositionNumber,
                        "MaterialDocument": oData.MaterialDocument,
                        "MaterialDocumentPos": oData.MaterialDocumentPos,
                        "MaterialNumber": oData.MaterialNumber,
                        "Ammount": oData.Ammount,
                        "UUID": datosCFDI.UUID
                    }
                };

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

                //  Adjuntar PDF
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
                            oMessagePDF = {
                                success: false,
                                message: "Error al adjuntar PDF"
                            };
                        }
                    } catch (pdfErr) {
                        console.error("[_subirAFI] Error adjuntar PDF:", pdfErr);
                        oMessagePDF = {
                            success: false,
                            message: "Error al adjuntar PDF: " + pdfErr.message
                        };
                    }
                }

                //  Adjuntar XML
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
                            oMessageXML = {
                                success: false,
                                message: "Error al adjuntar XML"
                            };
                        }
                    } catch (xmlErr) {
                        console.error("[_subirAFI] Error adjuntar XML:", xmlErr);
                        oMessageXML = {
                            success: false,
                            message: "Error al adjuntar XML: " + xmlErr.message
                        };
                    }
                }

                const aResults = [
                    {
                        label: "Factura a Base de Datos",
                        message: `Factura cargada en la base de datos}`,
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
                MessageBox.error("Error al cargar factura a la base de datos:\n" + (err.message || "Error desconocido"));
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

        _getDeviationConfirmation(aDeviations, nMaxQntyTolerance) {
            const nDeviation = aDeviations[0];
            const pConfirmation = new Promise((resolve) => {
                const oDialog = new Dialog({
                    type: "Message",
                    title: "Desviación",
                    content: new Text({ text: `La diferencia ${nDeviation} supera la desviación máxima ${nMaxQntyTolerance}` }),
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
        }
    });
});