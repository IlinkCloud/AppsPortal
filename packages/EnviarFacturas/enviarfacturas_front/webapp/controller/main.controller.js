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
            this.getBusinessPartner();
        },

        getBusinessPartner: function () {
            BusyIndicator.show(100);
            const url = "/odata/v4/invitacion/ReadSupplier";

            fetch(url, { method: "GET", headers: { "Accept": "application/json" }, credentials: "include" })
                .then(res => {
                    return res.ok ? res.json() : res.text().then(t => { throw new Error(t); });
                })
                .then(data => {
                    const aContactos = (data.value || []).map(bp => ({
                        UserID: bp.BusinessPartner,
                        UserNombre: bp.SupplierName
                    }));

                    let oModel = this.getView().getModel();
                    if (!oModel) {
                        oModel = new sap.ui.model.json.JSONModel({ UsrsDatos: [], Destinatario: null });
                        this.getView().setModel(oModel);
                    }
                    oModel.setProperty("/UsrsDatos", aContactos);

                    this.getReadGoodsReceipt(data.value);
                    BusyIndicator.hide();

                })
                .catch(err => {
                    console.error("[getBusinessPartner] Error:", err);
                    MessageBox.error("Error al cargar destinatarios");
                    BusyIndicator.hide();
                });
        },


        getReadGoodsReceipt: function (aSuppliers) {
            BusyIndicator.show(100);
            const url = `/odata/v4/goods-receipts/ReadGoodsReceipt`;

            fetch(url, { method: "GET", headers: { "Accept": "application/json" }, credentials: "include" })
                .then(res => {
                    return res.ok ? res.json() : res.text().then(t => { throw new Error(t); });
                })
                .then(data => {
                    const aFacturas = (data.value || []).map(item => {

                        const oSupplier = aSuppliers.find(oSup => oSup.Supplier === item.Supplier);

                        return {
                            MaterialDocument: item.MaterialDocument,
                            MaterialDocumentItem: item.MaterialDocumentItem,
                            PurchaseOrder: item.PurchaseOrder,
                            PurchaseOrderItem: item.PurchaseOrderItem,
                            SupplierName: oSupplier?.SupplierName,
                            Client: oSupplier?.CompanyCodeName,
                            ReferenceDocument: item.ReferenceDocument,
                            Condition: "",
                            MaterialDocumentHeaderText: item.MaterialDocumentHeaderText,
                            DocumentDate: new Date(item.DocumentDate.replace(/Z$/, '')),
                            QuantityInEntryUnit: parseFloat(item.QuantityInEntryUnit) || 0.0,
                            CompanyCode: oSupplier?.CompanyCode,
                            Supplier: oSupplier?.Supplier,
                            EffectiveAmount: item.EffectiveAmount,
                            DocumentCurrency: item.DocumentCurrency
                        }
                    });

                    this.getView().setModel(
                        new sap.ui.model.json.JSONModel({ results: aFacturas }),
                        "documents"
                    );

                    BusyIndicator.hide();
                })
                .catch(err => {
                    console.error("[getReadGoodsReceipt] Error:", err)
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
            const oTable = this.byId("docMatList");
            const oBinding = oTable.getBinding("items");

            const oStart = this.byId("startDatePicker").getDateValue();
            const oEnd = this.byId("endDatePicker").getDateValue();

            const aFilters = [];

            if (oStart) {
                aFilters.push(new sap.ui.model.Filter("DocumentDate", sap.ui.model.FilterOperator.GE, oStart));
            }
            if (oEnd) {
                aFilters.push(new sap.ui.model.Filter("DocumentDate", sap.ui.model.FilterOperator.LE, oEnd));
            }

            const oFinalFilter = new sap.ui.model.Filter({
                filters: aFilters,
                and: true
            });

            oBinding.filter(oFinalFilter);
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

                            for (const file of aFiles) {
                                const tipo = file.type;

                                const oContext = aSelected[0].getBindingContext("documents");
                                const oData = oContext.getObject();

                                const documentId = oData.MaterialDocument;
                                const proveedorId = oData.Supplier;
                                const sociedadId = oData.CompanyCode;
                                const fechaFactura = oData.DocumentDate?.toISOString().split('T')[0];

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
                                            // Consultar primero el valor de ValidacionPAC
                                            const validacionPAC = await oController.getValidacionPAC(); 

                                            let urlValidacion;
                                            if (validacionPAC) {
                                                // Si ValidacionPAC es true, usar ValidarCFDIListo
                                                urlValidacion = "/odata/v4/goods-receipts/ValidarFacturaReglasPac";
                                                console.log("[Validación] Usando ValidarCFDIListo (validación PAC activada)");
                                            } else {
                                                // Si ValidacionPAC es false, usar ValidarFactura
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

                                            const data = await res.json();
                                            if (data.valido) {
                                                if (data.datos) {
                                                    const oContext = aSelected[0].getBindingContext("documents");
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

                    })
                    ,
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

        formatDateForFrontEnd(date, odataVersion = "V2") {
            if (!date) return null;
            const d = new Date(date);
            return odataVersion === "V2"
                ? `/Date(${d.getTime()})/`
                : d.toISOString();
        },

        _subirAFI: async function (datosCFDI, pdfFile, xmlFile) {
            const oTable = this.getView().byId("docMatList");
            const aSelected = oTable.getSelectedItems();
            const nMaxQntyTolerance = 150;
            const aDeviations = [];
            let sInvoiceStatus = "5";

            for (let i = 0; i < aSelected.length; i++) {
                const oElement = aSelected[i];
                const oContext = oElement.getBindingContext("documents");
                const oData = oContext.getObject();
                const nTotalWithTax = oData.EffectiveAmount + (oData.EffectiveAmount * 0.16);

                if (nTotalWithTax + nMaxQntyTolerance < Number(datosCFDI.TOTAL)) {
                    const nDeviation = Math.abs(nTotalWithTax - Number(datosCFDI.TOTAL));
                    aDeviations.push(nDeviation);
                    break;
                }
            }

            if (aDeviations.length > 0) {
                const sResponse = await this._getDeviationConfirmation(aDeviations, nMaxQntyTolerance);
                if (sResponse === "Cancelar") {
                    return;
                } else {
                    sInvoiceStatus = "A";
                }
            }

            BusyIndicator.show(100);

            try {

                const payload = {
                    "Items": datosCFDI.Items,
                    "Reference": datosCFDI.ReferenceDocument,
                    "FixedUUID": datosCFDI.UUID,
                    "SupplierInvoiceStatus": sInvoiceStatus,
                    "CFDIData": {
                        UUID: datosCFDI.UUID,
                        BUKRS: datosCFDI.SOCIETY,
                        FOLIO: String(datosCFDI.FOLIO),
                        SERIE: String(datosCFDI.SERIE),
                        LIFNR: datosCFDI.SUPPLIER,
                        RFC: datosCFDI.RFC,
                        FKDAT: datosCFDI.INVOICE_DATE,
                        WAERS: datosCFDI.CURRENCY,
                        SUBTOTAL: datosCFDI.SUBTOTAL,
                        DESCUENTO: datosCFDI.DISCOUNT,
                        TOTAL_IMPUESTOSTRAS: datosCFDI.TOTAL_IMPUESTOSTRAS,
                        TOTAL_IMPUESTOSRET: datosCFDI.TOTAL_IMPUESTOSRET,
                        TOTAL: datosCFDI.TOTAL,
                        FORMA_PAGO: String(datosCFDI.FORM_OF_PAYMENT),
                        METODO_PAGO: String(datosCFDI.PAYMENT_METHOD),
                        USO_CFDI: datosCFDI.CFDI_USE,
                        ZED_TIPO_COMPROBANTE: datosCFDI.ZED_RECEIPT_TYPE,
                        XML: datosCFDI.XML
                    }
                };

                const res = await fetch("/odata/v4/goods-receipts/CreateSupplierInvoiceFromList", {
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
                    MessageBox.error("Error al subir a MIRO:\n" + errText);
                    BusyIndicator.hide();
                    return;
                }

                const data = await res.json();
                const oMessagePDF = await this.postLogAttachmentPDF(pdfFile, data.SupplierInvoice, datosCFDI.LIFNR);
                const oMessageXML = await this.postLogAttachmentXML(xmlFile, data.SupplierInvoice, datosCFDI.LIFNR);
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
                    },
                ];

                this._showResultDialog(aResults);
                BusyIndicator.hide();
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