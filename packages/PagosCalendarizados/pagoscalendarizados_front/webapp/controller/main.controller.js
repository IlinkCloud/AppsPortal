sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment",
    "sap/m/UploadCollectionParameter",
    "sap/m/PDFViewer",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/format/DateFormat"
], (Controller, Fragment, UploadCollectionParameter, PDFViewer, JSONModel, MessageToast, MessageBox, DateFormat) => {
    "use strict";
    var tipoUpload = "";
    var baulAnexos = { pdf: [], png: [], jpeg: [], msword: [], trash: [] };
    var anexosBLOB = {};
    var urlImage = "";
    var dPersL = "";
    var dIdL = "";
    var oODataJSONModel = new JSONModel();

    return Controller.extend("pagoscalendarizadosfront.controller.main", {
        onInit() {
            this._pdfViewer = new PDFViewer();
            this.getView().addDependent(this._pdfViewer);
            this.getView().addEventDelegate({
                onBeforeShow: function () {
                    this.getFacturasenRevision();
                }
            }, this);
        },

        ////////////////////// FETCH FACTURAS
        getFacturasenRevision: function () {
            fetch("/odata/v4/schedule-payments/Payments?$top=1000", {
                method: "GET",
                headers: { "Accept": "application/json" },
                credentials: "include"
            })
                .then(response => {
                    if (!response.ok) {
                        return response.text().then(errText => {
                            throw new Error(`HTTP ${response.status} - ${errText}`);
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    console.log("Respuesta API facturas:", data);
                    oODataJSONModel.setData(data.value || []);
                    this.getOwnerComponent().setModel(oODataJSONModel, "Payments");
                })
                .catch(error => console.error("Error:", error));
        },

        ////////////////////// FORMATO DE FECHAS
        formatODataDate: function (v) {
            if (!v) return "";
            let timestamp;
            const match = /\/Date\((\d+)\)\//.exec(v);
            if (match) {
                timestamp = parseInt(match[1], 10);
            } else {
                const parsed = Date.parse(v);
                if (isNaN(parsed)) return "";
                timestamp = parsed;
            }
            const date = new Date(timestamp);
            const oDateFormat = DateFormat.getDateInstance({ pattern: "dd-MM-yyyy" });
            return oDateFormat.format(date);
        },

        formatDate: function (v) {
            if (!v) return "";
            const date = new Date(v);
            if (isNaN(date.getTime())) return "";
            const oDateFormat = DateFormat.getDateInstance({ pattern: "dd-MM-yyyy" });
            return oDateFormat.format(date);
        },

        // Nueva función para formato "8 ene 2026"
        formatDateSimple: function (v) {
            if (!v) return "";
            const parts = v.split("-");
            if (parts.length !== 3) return "";
            const date = new Date(parts[0], parts[1] - 1, parts[2]);
            if (isNaN(date.getTime())) return "";
            const oDateFormat = DateFormat.getDateInstance({ pattern: "d MMM yyyy" });
            return oDateFormat.format(date);
        },

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

        ////////////////////// UPLOAD BUTTONS
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
        },

        uploadButton: function () {
            tipoUpload = "F";
            this.openUploadDialog(tipoUpload);
        },

        openUploadDialog: function (tipoUploadIn) {
            switch (tipoUploadIn) {
                case "F":
                    if (!this._uploadDialog2) {
                        this._uploadDialog2 = sap.ui.xmlfragment(tipoUpload, "pagoscalendarizadosfront.fragments.UploadInvoice", this);
                        this.getView().addDependent(this._uploadDialog2);
                    }
                    this._uploadDialog2.open();
                    break;
            }
        },

        ////////////////////// ONCHANGE UPLOAD
        onChange: function (oEvent) {
            var fileList = oEvent.getParameter("files");
            sap.ui.core.Fragment.byId(tipoUpload, "UploadCollection").setBusy(true);
            var bContinue = true;

            var uploadFiles = { xml: [], pdf: [] };
            if (fileList.length !== 2) {
                MessageBox.information("Se debe seleccionar un máximo de dos archivos por carga.");
                bContinue = false;
            }

            if (bContinue) {
                for (var i = 0; i < fileList.length; i++) {
                    if (fileList[i].type === "text/xml") uploadFiles.xml.push(fileList[i]);
                    if (fileList[i].type === "application/pdf") uploadFiles.pdf.push(fileList[i]);
                }
                if (uploadFiles.xml.length !== 1 || uploadFiles.pdf.length !== 1) {
                    MessageBox.information("Seleccione sólo un archivo XML y un PDF para continuar.");
                } else {
                    this.readCfdi(uploadFiles);
                }
            } else {
                sap.ui.core.Fragment.byId(tipoUpload, "UploadCollection").setBusy(false);
            }
        },

        ////////////////////// LEER CFDI / ARCHIVOS
        readCfdi: function (upFiles) {
            // Convertimos archivos a base64 o blob para enviarlos al backend
            anexosBLOB = {};
            if (upFiles.pdf) upFiles.pdf.forEach(f => anexosBLOB[f.name] = f);
            if (upFiles.xml) upFiles.xml.forEach(f => anexosBLOB[f.name] = f);

            sap.ui.core.Fragment.byId(tipoUpload, "UploadCollection").setBusy(false);
            MessageToast.show("Archivos listos para enviar");
        },

        ////////////////////// ELIMINAR FACTURA
        delFact: function () {
            sap.ui.getCore().setModel(null, "deliverTable");
            var uploadCollection = sap.ui.core.Fragment.byId(tipoUpload, "UploadCollection");
            var factList = sap.ui.core.Fragment.byId(tipoUpload, "factList");
            var closeDialog = sap.ui.core.Fragment.byId(tipoUpload, "closeDialog");

            uploadCollection.setVisible(true);
            factList.setVisible(false);
            closeDialog.setVisible(true);
        },

        ////////////////////// VER PDF
        pdfView: function (oEvent) {
            var pdfView = oEvent.getSource().getBindingContext("deliverTable").getProperty("/blob");
            var _pdfurl = URL.createObjectURL(pdfView);
            if (!this._PDFViewer) {
                this._PDFViewer = new PDFViewer({ width: "auto", source: _pdfurl });
                jQuery.sap.addUrlWhitelist("blob");
            }
            this._PDFViewer.open();
        },

        ////////////////////// FRAGMENT DOC DETAIL
        handlePressDocument: function (oEvent) {
            if (!this._oDialog) {
                this._oDialog = sap.ui.xmlfragment("docDialogs", "pagoscalendarizadosfront.fragments.DocDetail", this);
            }
            this.getView().addDependent(this._oDialog);
            this._oDialog.open();
        },

        ////////////////////// CERRAR DIALOG
        onCloseDialogUpload: function () {
            if (this._uploadDialog2) this._uploadDialog2.close();
        }
    });
});