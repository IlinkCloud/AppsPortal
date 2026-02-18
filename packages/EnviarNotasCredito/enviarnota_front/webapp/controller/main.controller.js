sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Icon",
    "sap/ui/core/BusyIndicator",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], (Controller, Icon, BusyIndicator, MessageBox, MessageToast) => {

    "use strict";

    return Controller.extend("enviarnotafront.controller.main", {
        onInit: function () {
            this.getView().setModel(new sap.ui.model.json.JSONModel({ Sociedades: [] }), "sociedades");
            this.getBusinessPartner();
            this.getCreditNotesReceipt();
        },

        getBusinessPartner: function () {
            BusyIndicator.show(100);
            const url = "/odata/v4/invitacion/ReadSupplier";
            console.log("[getBusinessPartner] URL: ", url);

            fetch(url, {
                method: "GET",
                headers: { "Accept": "application/json" },
                credentials: "include"
            })
                .then(res => {
                    console.log("[getBusinessPartner] Respuesta: ", res.status, res.statusText);
                    return res.ok ? res.json() : res.text().then(t => { throw new Error(t); });
                })
                .then(data => {
                    console.log("[getBusinessPartner] Datos Crudos: ", data);

                    const aContactos = (data.value || []).map(bp => ({
                        UserID: bp.BusinessPartner,
                        UserNombre: bp.SupplierName
                    }));

                    let oModel = this.getView().getModel();
                    if (!oModel) {
                        oModel = new sap.ui.model.json.JSONModel({ UsrsDatos: [], Destinatarios: null });
                        this.getView().setModel(oModel);
                    }
                    oModel.setProperty("/UsrsDatos", aContactos);

                    this.getCreditNotesReceipt(data.value);
                    BusyIndicator.hide();
                })
                .catch(err => {
                    console.error("[getBusinessPartner] Error: ", err);
                    MessageBox.error("Error al cargar destinatarios");
                    BusyIndicator.hide();
                });
        },

        getCreditNotesReceipt: function (aSuppliers) {
            BusyIndicator.show(100);
            const url = "/odata/v4/credit-notes-reception/ReadCreditNotesReceipt";

            fetch(url, {
                method: "GET",
                headers: { "Accept": "application/json" },
                credentials: "include"
            })
                .then(res => res.ok ? res.json() : res.text().then(t => { throw new Error(t); }))
                .then(data => {
                    console.log("[getCreditNotesReceipt] Datos crudos:", data);

                    const aFacturas = (data.value || []).map(item => {
                        const oSupplier = aSuppliers?.find(oSup => oSup.Supplier === item.Supplier);

                        return {
                            PurchaseOrder: item.PurchaseOrder,
                            MaterialDocument: item.MaterialDocument,
                            MaterialDocumentItem: item.MaterialDocumentItem,
                            GoodsMovementType: item.GoodsMovementType || "",
                            SupplierName: oSupplier?.SupplierName || "",
                            Supplier: item.Supplier || "",
                            Plant: item.Plant || "",
                            CompanyCodeName: oSupplier?.CompanyCodeName || "",
                            ReferenceDocument: item.ReferenceDocument,
                            MaterialDocumentHeaderText: item.MaterialDocumentHeaderText,
                            EffectiveAmount: item.EffectiveAmount || item.QuantityInEntryUnit || 0,
                            DocumentDate: item.DocumentDate,
                            PurchaseOrderItem: item.PurchaseOrderItem || null,
                            Currency: item.DocumentCurrency,
                            HoldingTaxType: item.HoldingTaxType,
                            HoldingTaxCode: item.HoldingTaxCode
                        };
                    });

                    this._aAllDocs = aFacturas.slice();
                    this.getView().setModel(
                        new sap.ui.model.json.JSONModel({ results: aFacturas }),
                        "documents"
                    );

                    BusyIndicator.hide();
                })
                .catch(err => {
                    console.error("[getCreditNotesReceipt] Error:", err)
                    BusyIndicator.hide();
                });
        },

        postLogAttachmentPDF: function (file, documentId) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const pdfBase64 = btoa(e.target.result);

                const payload = {
                    documentId,
                    pdfBase64
                };

                const res = await fetch("/odata/v4/credit-notes-reception/AdjuntarFacturaPDF", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify(payload),
                    credentials: "include"
                });

                const data = await res.json();
                console.log("[postLogAttachmentPDF] Datos crudos:", data);
            };
            reader.readAsBinaryString(file);
        },

        postLogAttachmentXML: function (file, documentId) {
            const url = "/odata/v4/credit-notes-reception/AdjuntarFacturaXML";
            const formData = new FormData();
            formData.append("file", file);
            formData.append("documentId", documentId);

            fetch(url, {
                method: "POST",
                body: formData,
                credentials: "include"
            })
                .then(res => res.ok ? res.json() : res.text().then(t => { throw new Error(t); }))
                .then(data => console.log("[postLogAttachmentXML] Datos crudos:", data))
                .catch(err => console.error("[postLogAttachmentXML] Error:", err));
        },

        postReturnSat: function () {
            const url = "/odata/v4/credit-notes-reception/validarCFDIEnSAT";
            console.log("[postReturnSat] URL:", url);

            fetch(url, { method: "POST", headers: { "Accept": "application/json" }, credentials: "include" })
                .then(res => {
                    console.log("[postReturnSat] Respuesta:", res.status, res.statusText);
                    return res.ok ? res.json() : res.text().then(t => { throw new Error(t); });
                })
                .catch(err => console.error("[postReturnSat] Error:", err));
        },

        postReturnSatPac: function () {
            const url = "/odata/v4/credit-notes-reception/ValidarCFDIListo";
            console.log("[postReturnSatPac] URL:", url);

            fetch(url, { method: "POST", headers: { "Accept": "application/json" }, credentials: "include" })
                .then(res => {
                    console.log("[postReturnSatPac] Respuesta:", res.status, res.statusText);
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
                aFilters.push(new sap.ui.model.Filter("DocumentDate", sap.ui.model.FilterOperator.GE, this.formatDateForBackend(oStart)));
            }
            if (oEnd) {
                aFilters.push(new sap.ui.model.Filter("DocumentDate", sap.ui.model.FilterOperator.LE, this.formatDateForBackend(oEnd)));
            }
            const oFinalFilter = new sap.ui.model.Filter({
                filters: aFilters,
                and: true
            });
            oBinding.filter(oFinalFilter);
        },

        filtrado: function (oEvent) {
            // liveChange entrega "newValue", search entrega "query"
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

        validateSociety: function () {
            console.log("validateSociety triggered");
        },

        uploadButton: function () {
            const that = this;
            if (!this._oUploadDialog) {
                let aFiles = [];
                const oFileUploader = new sap.ui.unified.FileUploader({
                    id: "fileUploader",
                    name: "file",
                    multiple: true,
                    maximumFileSize: 10,
                    mimeType: ["application/pdf", "text/xml", "application/xml"],
                    change: async function (oEvent) {
                        const files = Array.from(oEvent.getParameter("files"));
                        aFiles = files;
                        oAnexosLabel.setText(`Anexos (${files.length})`);
                        oFileList.removeAllItems();
                        for (const file of files) {
                            if (file.size > 10 * 1024 * 1024) {
                                sap.m.MessageBox.error(`El archivo "${file.name}" excede el límite de 10 Mb.`);
                                continue;
                            }
                            if (!(file.type === "application/pdf" || file.type === "text/xml" || file.type === "application/xml")) {
                                sap.m.MessageBox.error(`El archivo "${file.name}" no es válido. Solo se permiten PDF o XML.`);
                                continue;
                            }
                            oFileList.addItem(new sap.m.StandardListItem({ title: file.name }));
                        }
                    }.bind(this)
                });

                const oAnexosLabel = new sap.m.Label({
                    text: "Anexos (0)",
                    design: "Bold",
                    width: "100%",
                    textAlign: "Center"
                });

                const oFileList = new sap.m.List({
                    headerText: "Archivos seleccionados",
                    visible: true,
                    items: []
                });

                this._oUploadDialog = new sap.m.Dialog({
                    title: "Cargar Archivos CFDI",
                    contentWidth: "400px",
                    contentHeight: "auto",
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
                                new sap.m.Text({ text: "Selecciona o Arrastra el XML y PDF", textAlign: "Center" }),
                                oFileUploader,
                                oFileList
                            ]
                        })
                    ],
                    beginButton: new sap.m.Button({
                        text: "Subir",
                        type: "Emphasized",
                        press: async function () {
                            if (!aFiles || aFiles.length !== 2) {
                                sap.m.MessageBox.error("Debes subir ambos archivos: XML y PDF.");
                                return;
                            }

                            let pdfFile = aFiles.find(f => f.type === "application/pdf");
                            let xmlFile = aFiles.find(f => f.type === "text/xml" || f.type === "application/xml");
                            const hasXML = aFiles.some(f => f.type === "text/xml" || f.type === "application/xml");
                            const hasPDF = aFiles.some(f => f.type === "application/pdf");

                            if (!hasXML || !hasPDF) {
                                sap.m.MessageBox.error("Debes subir un archivo XML y un archivo PDF.");
                                return;
                            }

                            if (!xmlFile || !xmlFile.name || xmlFile.name.trim() === "") {
                                sap.m.MessageBox.error("Los archivos debe tener un nombre válido.");
                                return;
                            }

                            const oTable = this.byId("docMatList");
                            for (const file of aFiles) {
                                const aSelected = oTable.getSelectedItems();
                                if (aSelected.length === 0) {
                                    sap.m.MessageBox.error("Debes seleccionar un documento en la tabla antes de subir archivos.");
                                    return;
                                }

                                const oContext = aSelected[0].getBindingContext("documents");
                                const oData = oContext.getObject();
                                console.log("[Front] supplierInvoiceId:", oData.MaterialDocument);
                                console.log("[Front] PDF file size:", pdfFile.size, "bytes");
                                console.log("[Front] XML file size:", xmlFile.size, "bytes");

                                if (file.type === "application/pdf") {
                                    pdfFile = file;
                                } else if (file.type === "text/xml" || file.type === "application/xml") {
                                    xmlFile = file;
                                    const reader = new FileReader();
                                    reader.onload = async (e) => {
                                        const xmlContent = e.target.result;
                                        if (!xmlContent || xmlContent.trim() === "") {
                                            sap.m.MessageBox.error("El archivo XML está vacío o no se pudo leer.");
                                            return;
                                        }

                                        const xmlBase64 = btoa(xmlContent);
                                        const payload = {
                                            xmlBase64,
                                            proveedorId: oData.Supplier,
                                            sociedadId: oData.Plant,
                                            tipoDocumento: "E",
                                            fechaFactura: this.formatDateForBackend(oData.DocumentDate)
                                        };

                                        try {
                                            // Consultar primero el valor de ValidacionPAC
                                            const validacionPAC = await this.getValidacionPAC();

                                            let urlValidacion;
                                            if (validacionPAC) {
                                                // Si ValidacionPAC es true, usar ValidarCFDIListo
                                                urlValidacion = "/odata/v4/credit-notes-reception/ValidarFacturaReglasPac";
                                                console.log("[Validación] Usando ValidarCFDIListo (validación PAC activada)");
                                            } else {
                                                // Si ValidacionPAC es false, usar ValidarFactura
                                                urlValidacion = "/odata/v4/credit-notes-reception/ValidarFactura";
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
                                                sap.m.MessageBox.error("Error al validar nota de crédito:\n" + errText);
                                                return;
                                            }

                                            const data = await res.json();
                                            if (data.valido && data.datos) {
                                                const supplierInvoiceStatus = "A";
                                                data.datos.supplierInvoiceStatus = supplierInvoiceStatus;
                                                data.datos.Items = [{
                                                    MaterialDocument: oData.MaterialDocument || "",
                                                    MaterialDocumentItem: oData.MaterialDocumentItem || "1",
                                                    PurchaseOrder: oData.PurchaseOrder,
                                                    PurchaseOrderItem: String(oData.PurchaseOrderItem),
                                                    Supplier: oData.Supplier || data.datos.SUPPLIER,
                                                    Plant: oData.Plant || data.datos.SOCIETY,
                                                    QuantityInEntryUnit: oData.QuantityInEntryUnit || 1
                                                }];
                                                data.datos.Reference = oData.ReferenceDocument || "SIN REFERENCIA";
                                                data.datos.FixedUUID = data.datos.Comprobante?.['cfdi:Complemento']?.['tfd:TimbreFiscalDigital']?.['@_UUID'] || null;
                                                data.datos.XMLBase64 = xmlBase64;
                                                that._mostrarResumenCFDI(data.datos, pdfFile, xmlFile, oData);
                                                that._oUploadDialog.close();
                                                that.uploadButton();
                                            } else {
                                                const errores = data.errores ?? (data.mensaje ? [data.mensaje] : ["Factura inválida"]);
                                                MessageBox.error("Factura inválida:\n" + errores.join("\n"));
                                                if (that._oUploadDialog) {
                                                    that._oUploadDialog.close();
                                                    that._oUploadDialog.destroy();
                                                    that._oUploadDialog = null;
                                                }
                                                const uuidError = errores.find(e => e.includes("UUID") && e.includes("repetido"));
                                                if (uuidError) {
                                                    const oDialog = new sap.m.Dialog({
                                                        title: "UUID repetido",
                                                        type: "Message",
                                                        state: "Warning",
                                                        content: new sap.m.Text({
                                                            text: "Esta factura ya fue procesada. ¿Deseas cargar otra?"
                                                        }),
                                                        beginButton: new sap.m.Button({
                                                            text: "Subir otra factura",
                                                            type: "Emphasized",
                                                            press: () => {
                                                                oDialog.close();
                                                                that.uploadButton();
                                                            }
                                                        }),
                                                        endButton: new sap.m.Button({
                                                            text: "Cerrar",
                                                            press: () => oDialog.close()
                                                        }),
                                                        afterClose: () => { this._oUploadDialog.close(); }
                                                    });
                                                    oDialog.open();
                                                }
                                            }
                                        } catch (err) {
                                            console.error("[ValidarFactura] Error:", err);
                                            const msg = err?.message || JSON.stringify(err) || "Error desconocido";
                                            MessageBox.error("Error al validar factura:\n" + msg);
                                            if (that._oUploadDialog) {
                                                that._oUploadDialog.close();
                                                that._oUploadDialog.destroy();
                                                that._oUploadDialog = null;
                                            }
                                        }
                                    };
                                    reader.readAsBinaryString(file);
                                }
                            }
                        }.bind(this)
                    }),
                    endButton: new sap.m.Button({
                        text: "Cerrar",
                        type: "Reject",
                        press: function () {
                            this._oUploadDialog.close();
                        }.bind(this)
                    }),
                    afterClose: function () {
                        this._oUploadDialog.close();
                    }.bind(this)
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

        // Utilidad para formatear fecha en AAAA-MM-DD
        formatDateForBackend: function (date) {
            if (!date) return null;
            const d = new Date(date);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        },

        formatDateForFrontEnd: function (date, odataVersion = "V2") {
            if (!date) return null;
            const d = new Date(date);
            return odataVersion === "V2"
                ? `/Date(${d.getTime()})/`
                : d.toISOString();
        },


        _mostrarResumenCFDI: function (datosCFDI, pdfFile, xmlFile, oData) {
            const oTableResumen = new sap.m.Table({
                columns: [
                    new sap.m.Column({ header: new sap.m.Label({ text: "Cliente", textAlign: "Center" }), hAlign: "Center" }),
                    new sap.m.Column({ header: new sap.m.Label({ text: "Factura", textAlign: "Center" }), hAlign: "Center" }),
                    new sap.m.Column({ header: new sap.m.Label({ text: "Subtotal", textAlign: "Center" }), hAlign: "Center" }),
                    new sap.m.Column({ header: new sap.m.Label({ text: "Impuesto retenido", textAlign: "Center" }), hAlign: "Center" }),
                    new sap.m.Column({ header: new sap.m.Label({ text: "Impuestos", textAlign: "Center" }), hAlign: "Center" }),
                    new sap.m.Column({ header: new sap.m.Label({ text: "Total", textAlign: "Center" }), hAlign: "Center" }),
                    new sap.m.Column({ header: new sap.m.Label({ text: "Acciones", textAlign: "Center" }), hAlign: "Center" })
                ]
            });

            oTableResumen.addItem(new sap.m.ColumnListItem({
                cells: [
                    new sap.m.Text({ text: oData.CompanyCodeName || "—", textAlign: "Center" }),
                    new sap.m.Text({ text: datosCFDI.FOLIO || "—", textAlign: "Center" }),
                    new sap.m.Text({ text: `${datosCFDI.SUBTOTAL || "0.00"} ${datosCFDI.CURRENCY || ""}`, textAlign: "Center" }),
                    new sap.m.Text({ text: `${datosCFDI.TOTAL_IMPUESTOSRET || "0.00"} ${datosCFDI.CURRENCY || ""}`, textAlign: "Center" }),
                    new sap.m.Text({ text: `${datosCFDI.TOTAL_IMPUESTOSTRAS || "0.00"} ${datosCFDI.CURRENCY || ""}`, textAlign: "Center" }),
                    new sap.m.Text({ text: `${datosCFDI.TOTAL || "0.00"} ${datosCFDI.CURRENCY || ""}`, textAlign: "Center" }),
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
                            }),
                            new sap.m.Button({
                                icon: "sap-icon://delete",
                                tooltip: "Eliminar",
                                type: "Reject",
                                press: () => {
                                    sap.m.MessageBox.confirm("¿Deseas eliminar esta factura?", {
                                        title: "Confirmar eliminación",
                                        actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
                                        onClose: (sAction) => {
                                            if (sAction === sap.m.MessageBox.Action.YES) {
                                                oDialog.close();
                                            }
                                        }
                                    });
                                }
                            })
                        ]
                    })
                ]
            }));

            const oDialog = new sap.m.Dialog({
                title: "Resumen CFDI",
                contentWidth: "90%",
                contentHeight: "auto",
                content: [oTableResumen],
                beginButton: new sap.m.Button({
                    text: "Cerrar",
                    type: "Reject",
                    press: () => oDialog.close()
                }),
                afterClose: () => oDialog.destroy()
            });

            oDialog.open();
        },

        _verPDF: function (pdfFile) {
            if (!pdfFile) {
                sap.m.MessageToast.show("No hay archivo para visualizar");
                return;
            }

            if (pdfFile.type !== "application/pdf") {
                sap.m.MessageToast.show("El archivo seleccionado no es un PDF válido");
                return;
            }

            const sFileUrl = URL.createObjectURL(pdfFile);

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
            try {
                const oTable = this.byId("docMatList");
                const aSelected = oTable.getSelectedItems();
                if (aSelected.length === 0) {
                    sap.m.MessageBox.error("Debes seleccionar al menos un documento en la tabla.");
                    return;
                }

                const items = [];
                const lineTaxCodes = {};
                aSelected.forEach((sel) => {
                    const oData = sel.getBindingContext("documents").getObject();
                    items.push({
                        MaterialDocument: oData.MaterialDocument || "",
                        MaterialDocumentItem: oData.MaterialDocumentItem || "1",
                        PurchaseOrder: oData.PurchaseOrder || "",
                        PurchaseOrderItem: oData.PurchaseOrderItem ? String(oData.PurchaseOrderItem) : "00000",
                        Supplier: oData.Supplier || datosCFDI.SUPPLIER || "",
                        Plant: oData.Plant || datosCFDI.SOCIETY || "",
                        QuantityInEntryUnit: oData.QuantityInEntryUnit || 1,
                    });
                    const key = `${oData.PurchaseOrder}-${oData.PurchaseOrderItem}`;
                    if (oData.TaxCode && oData.TaxCode.trim()) {
                        lineTaxCodes[key] = oData.TaxCode.trim();
                    }
                });

                const payload = {
                    Items: items,
                    Reference: String(datosCFDI.FOLIO || "SIN REFERENCIA"),
                    FixedUUID: datosCFDI.UUID || null,
                    DocumentHeaderText: String(datosCFDI.FOLIO || "SIN REFERENCIA"),
                    LineTaxCodes: JSON.stringify(lineTaxCodes),
                    SupplierInvoiceStatus: datosCFDI.supplierInvoiceStatus || "5",
                    CFDIData: {
                        UUID: datosCFDI.UUID,
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
                        SOCIETY: datosCFDI.SOCIETY || ""
                    }
                };

                // Crear factura en MIRO
                const res = await fetch("/odata/v4/credit-notes-reception/CreateSupplierInvoiceFromList", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Accept": "application/json" },
                    body: JSON.stringify(payload),
                    credentials: "include"
                });

                if (!res.ok) {
                    const errText = await res.text();
                    this.mostrarError(errText, datosCFDI.CURRENCY);
                    return;
                }

                const data = await res.json();
                const invoiceId = data.SupplierInvoice || "sin ID";

                let pdfResult, xmlResult;

                if (pdfFile) {
                    const pdfBase64 = await this._convertFileToBase64(pdfFile);
                    const resPdf = await fetch("/odata/v4/credit-notes-reception/AdjuntarFacturaPDF", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            documentId: invoiceId,
                            supplier: datosCFDI.SUPPLIER,
                            pdfBase64
                        }),
                        credentials: "include"
                    });
                    pdfResult = await resPdf.json();
                }

                if (xmlFile) {
                    const xmlBase64 = await this._convertFileToBase64(xmlFile);
                    const resXml = await fetch("/odata/v4/credit-notes-reception/AdjuntarFacturaXML", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            documentId: invoiceId,
                            supplier: datosCFDI.SUPPLIER,
                            xmlBase64
                        }),
                        credentials: "include"
                    });
                    xmlResult = await resXml.json();
                }

                const oDialog = new sap.m.Dialog({
                    title: "Factura enviada a MIRO",
                    contentWidth: "400px",
                    type: "Message",
                    state: "Success",
                    content: [
                        new sap.m.VBox({
                            width: "100%",
                            items: [
                                new sap.m.ObjectStatus({
                                    text: "Factura enviada a MIRO",
                                    state: "Success",
                                    icon: "sap-icon://document-text"
                                }),
                                new sap.m.Text({ text: `ID generado: ${invoiceId}` }),

                                new sap.m.ObjectStatus({
                                    text: "Adjunto PDF",
                                    state: pdfResult?.estado === "EXITOSO" ? "Success" : "Error",
                                    icon: "sap-icon://pdf-attachment"
                                }),
                                new sap.m.Text({
                                    text: pdfResult?.mensaje || "No se recibió respuesta del adjunto PDF"
                                }),

                                new sap.m.ObjectStatus({
                                    text: "Adjunto XML",
                                    state: xmlResult?.estado === "EXITOSO" ? "Success" : "Error",
                                    icon: "sap-icon://attachment"
                                }),
                                new sap.m.Text({
                                    text: xmlResult?.mensaje || "No se recibió respuesta del adjunto XML"
                                })
                            ]
                        })
                    ],
                    beginButton: new sap.m.Button({
                        text: "Copiar ID",
                        type: "Emphasized",
                        press: function () {
                            navigator.clipboard.writeText(invoiceId)
                                .then(() => sap.m.MessageToast.show("ID copiado al portapapeles"))
                                .catch(() => sap.m.MessageBox.error("No se pudo copiar el ID"));
                        }
                    }),
                    endButton: new sap.m.Button({
                        text: "Cerrar",
                        type: "Reject",
                        press: function () { oDialog.close(); }
                    }),
                    afterClose: function () { oDialog.destroy(); }
                });
                if (oTable) {
                    oTable.removeSelections(true);
                }
                oDialog.open();
            } catch (err) {
                sap.m.MessageBox.error(
                    "Error inesperado al registrar la factura:\n" +
                    (err.message || "Desconocido")
                );

            }
        },

        _convertFileToBase64: function (file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(",")[1]);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        },

        mostrarError: function (errText, CURRENCY) {
            // Caso 1: Error de balance contable
            if (errText.includes("Balance not zero")) {
                const match = errText.match(/debits:\s([\d.,]+)\s+credits:\s([\d.,]+)/);
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
                } else {
                    sap.m.MessageBox.error("El balance contable no cuadra.\n" + errText);
                }
            }
            // Caso 2: Falta TaxCode en la OC
            else if (errText.includes("Enter a tax code in item")) {
                sap.m.MessageBox.error(
                    "La orden de compra seleccionada no tiene código de impuesto configurado.\n" +
                    "Contacte al equipo de finanzas para corregirlo en S/4HANA."
                );
            }
            // Caso 3: Otros errores
            else {
                sap.m.MessageBox.error("Error al registrar la factura:\n" + errText);
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


    });
});