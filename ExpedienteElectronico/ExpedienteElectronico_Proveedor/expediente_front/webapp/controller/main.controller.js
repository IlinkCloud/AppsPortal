sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/odata/v4/ODataModel",
    "sap/ui/core/routing/History",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/UIComponent",
    "sap/m/PDFViewer"
], (Controller, Fragment, JSONModel, ODataModel, History, MessageBox, MessageToast, UIComponent, PDFViewer) => {
    "use strict";

    return Controller.extend("expedientefront.controller.main", {

        onInit() {
            this._initializeViewModels();
            this._initializeServiceModel();
            this._loadPageData();
        },

        /**
         * Initializes the JSON models used by the view.
         */
        _initializeViewModels() {
            this.getView().setModel(new JSONModel({
                filesUploaded: 0,
                filesRequired: 0,
                selectedTab: "general"
            }), "viewModel");

            this.getView().setModel(
                new JSONModel({}),
                "supplierData"
            );

            this.getView().setModel(
                new JSONModel({
                    return: false,
                    expediente: false,
                    AccType: "",
                    AccTypeId: "",
                }),
                "provData"
            );

            this.getView().setModel(new JSONModel({
                items: [],
                selectedSupplier: ""
            }), "supplierSelector");

            this.getView().setModel(
                new JSONModel({
                    documentItem: []
                }),
                "supplierDocs"
            );

            this.getView().setModel(new JSONModel({
                items: []
            }), "accountTypeList");
        },

        /**
         * Initializes the CAP OData V4 service model.
         */
        _initializeServiceModel() {
            const oServiceModel = new ODataModel({
                serviceUrl: "/odata/v4/invitacion/",
                synchronizationMode: "None"
            });

            this.getView().setModel(
                oServiceModel,
                "supplierService"
            );

            const oPortalModel = new ODataModel({
                serviceUrl: "/odata/v4/portal/",
                synchronizationMode: "None"
            });

            this.getView().setModel(oPortalModel, "portalService");

            const oExpedientAdminModel = new ODataModel({
                serviceUrl: "/odata/v4/expedient-admin/",
                synchronizationMode: "None"
            });

            this.getView().setModel(
                oExpedientAdminModel,
                "expedientAdminService"
            );

            const oExpedientFilesModel = new ODataModel({
                serviceUrl: "/odata/v4/expedient-files/",
                synchronizationMode: "None"
            });

            this.getView().setModel(
                oExpedientFilesModel,
                "expedientFilesService"
            );

            const oObjectStoreModel = new ODataModel({
                serviceUrl: "/object-store/",
                synchronizationMode: "None"
            });

            this.getView().setModel(
                oObjectStoreModel,
                "objectStoreService"
            );
        },

        async _loadPageData() {
            try {
                this._setBusy(true);

                await this._loadAccountTypes();
                const aSuppliers = await this._loadUserSuppliers();
                const sSupplier = String(aSuppliers[0].Supplier);
                const oSupplier = await this._loadSupplierData(sSupplier);

                const oRelation = await this._loadSupplierGroupRelation(
                    oSupplier.CompanyCode,
                    oSupplier.BusinessPartner
                );

                if (oRelation) {
                    await this._loadGroupDocuments(
                        oRelation.GroupId,
                        oSupplier.BusinessPartner
                    );
                }

            } catch (oError) {
                this._handleError(oError);
            } finally {
                this._setBusy(false);
            }
        },

        async _loadSupplierData(sSupplier) {
            const oServiceModel = this.getView().getModel("supplierService");

            if (!oServiceModel) {
                throw new Error("The supplier service model is not available.");
            }

            const oOperation = oServiceModel.bindContext(
                `/ReadSupplier(...)`
            );

            oOperation.setParameter("Supplier", sSupplier);

            await oOperation.execute();

            const oResult = oOperation.getBoundContext().getObject();
            const aSuppliers = oResult?.value ?? [];

            if (!aSuppliers.length) {
                throw new Error(this._getText("adminEE.supplierNotAvailable"));
            }

            const oSupplier = aSuppliers[0];

            this.getView()
                .getModel("supplierData")
                .setData(oSupplier);

            return oSupplier;
        },

        async _loadSupplierGroupRelation(sCompanyCode, sBusinessPartner) {
            const oModel = this.getView().getModel("expedientAdminService");

            if (!oModel) {
                throw new Error("The expedient admin service model is not available.");
            }

            const oOperation = oModel.bindContext("/GetExpedientGroupRelations(...)");
            oOperation.setParameter("companyCode", sCompanyCode);
            oOperation.setParameter("businessPartner", sBusinessPartner);
            await oOperation.execute();

            const oResult =
                oOperation
                    .getBoundContext()
                    .getObject();

            const aRelations = oResult?.value ?? [];
            const oProvModel = this.getView().getModel("provData");

            if (aRelations.length > 0) {
                const oRelation = aRelations[0];

                oProvModel.setProperty("/AccTypeId", String(oRelation.GroupId));
                oProvModel.setProperty("/AccType", oRelation.GroupDescription);
                oProvModel.setProperty("/return", false);
                oProvModel.setProperty("/expediente", true);
                return oRelation;
            }

            oProvModel.setProperty("/AccTypeId", "");
            oProvModel.setProperty("/AccType", "");
            oProvModel.setProperty("/return", true);
            oProvModel.setProperty("/expediente", false);
            return null;
        },

        async onSupplierChange(oEvent) {
            const sSupplier = oEvent.getParameter("selectedItem")?.getKey();

            if (!sSupplier) {
                return;
            }

            const oIconTabBar = this.byId("iconTabBar");
            const sSelectedTab = oIconTabBar.getSelectedKey();

            try {
                this._setBusy(true);
                this._resetSupplierState();
                const oSupplier = await this._loadSupplierData(String(sSupplier));
                const oRelation = await this._loadSupplierGroupRelation(oSupplier.CompanyCode, oSupplier.BusinessPartner);
                if (oRelation) {
                    await this._loadGroupDocuments(
                        oRelation.GroupId,
                        oSupplier.BusinessPartner
                    );

                    this.getView()
                        .getModel("viewModel")
                        .setProperty(
                            "/selectedTab",
                            sSelectedTab === "documents"
                                ? "documents"
                                : "general"
                        );
                } else {
                    this.getView()
                        .getModel("viewModel")
                        .setProperty(
                            "/selectedTab",
                            "general"
                        );
                }
            } catch (oError) {
                this._handleError(oError);
            } finally {
                this._setBusy(false);
            }
        },

        _resetSupplierState() {
            this.getView()
                .getModel("supplierDocs")
                .setProperty("/documentItem", []);

            this.getView()
                .getModel("viewModel")
                .setProperty("/filesUploaded", 0);

            this.getView()
                .getModel("viewModel")
                .setProperty("/filesRequired", 0);

            const oProvModel = this.getView().getModel("provData");

            oProvModel.setProperty("/AccType", "");
            oProvModel.setProperty("/AccTypeId", "");
            oProvModel.setProperty("/return", false);
            //oProvModel.setProperty("/expediente", false);
        },

        async _openUploadProgressDialog() {
            if (!this._oUploadProgressDialog) {
                this._oUploadProgressDialog =
                    await Fragment.load({
                        id: this.getView().getId(),
                        name: "expedientefront.fragment.UploadProgress",
                        controller: this
                    });

                this.getView().addDependent(
                    this._oUploadProgressDialog
                );
            }

            const oProgress =
                Fragment.byId(
                    this.getView().getId(),
                    "uploadProgressIndicator"
                );

            oProgress.setPercentValue(0);
            oProgress.setDisplayValue("");
            oProgress.setShowValue(false);
            oProgress.setState("Information");

            Fragment.byId(
                this.getView().getId(),
                "uploadProgressText"
            ).setText(
                this._getText(
                    "adminEE.uploadingDocument"
                )
            );

            Fragment.byId(
                this.getView().getId(),
                "uploadProgressStatus"
            ).setText("");

            this._oUploadProgressDialog.open();
        },

        async _showUploadCompleted() {
            if (!this._oUploadProgressDialog) {
                return;
            }

            const sFragmentId = this.getView().getId();

            const oProgress = Fragment.byId(
                sFragmentId,
                "uploadProgressIndicator"
            );

            const oProgressText = Fragment.byId(
                sFragmentId,
                "uploadProgressText"
            );

            const oProgressStatus = Fragment.byId(
                sFragmentId,
                "uploadProgressStatus"
            );

            oProgress.setPercentValue(100);
            oProgress.setDisplayValue("100%");
            oProgress.setShowValue(true);
            oProgress.setState("Success");

            oProgressText.setText(
                this._getText(
                    "adminEE.uploadCompleted"
                )
            );

            oProgressStatus.setText(
                this._getText(
                    "adminEE.uploadCompletedStatus"
                )
            );

            await new Promise(
                (resolve) => setTimeout(resolve, 1000)
            );

            this._oUploadProgressDialog.close();
        },

        _showUploadError() {
            if (!this._oUploadProgressDialog) {
                return;
            }

            const sFragmentId = this.getView().getId();

            const oProgress = Fragment.byId(
                sFragmentId,
                "uploadProgressIndicator"
            );

            const oProgressText = Fragment.byId(
                sFragmentId,
                "uploadProgressText"
            );

            oProgress.setState("Error");
            oProgress.setShowValue(false);
            oProgress.setDisplayValue("");

            oProgressText.setText(
                this._getText(
                    "adminEE.uploadError"
                )
            );
        },

        onAccountTypeChange(oEvent) {
            const oSelectedItem = oEvent.getParameter("selectedItem");

            if (!oSelectedItem) {
                return;
            }

            const oContext = oSelectedItem.getBindingContext(
                "accountTypeList"
            );

            if (!oContext) {
                return;
            }

            const oGroup = oContext.getObject();
            const oProvModel = this.getView().getModel("provData");
            oProvModel.setProperty("/AccTypeId", String(oGroup.Id));
            oProvModel.setProperty("/AccType", oGroup.Description);
        },

        async _loadUserSuppliers() {
            const oPortalModel = this.getView().getModel("portalService");

            if (!oPortalModel) {
                throw new Error("The portal service model is not available.");
            }

            const oOperation = oPortalModel.bindContext(
                "/ReadUserByEmail(...)"
            );

            await oOperation.execute();

            const oResult = oOperation.getBoundContext().getObject();
            const aSuppliers = oResult?.value ?? [];

            if (!aSuppliers.length) {
                throw new Error(
                    this._getText("adminEE.noSuppliersAssigned")
                );
            }

            const oSelectorModel = this.getView().getModel("supplierSelector");

            oSelectorModel.setProperty("/items", aSuppliers);

            const sFirstSupplier = String(aSuppliers[0].Supplier);

            oSelectorModel.setProperty(
                "/selectedSupplier",
                sFirstSupplier
            );

            return aSuppliers;
        },

        async _loadAccountTypes() {
            const oModel = this.getView().getModel("expedientAdminService");

            if (!oModel) {
                throw new Error(
                    "The expedient admin service model is not available."
                );
            }

            const oListBinding = oModel.bindList("/GetGroups");

            const aContexts = await oListBinding.requestContexts();

            const aGroups = aContexts.map(
                (oContext) => oContext.getObject()
            );

            this.getView()
                .getModel("accountTypeList")
                .setProperty("/items", aGroups);

            return aGroups;
        },

        async onSaveAnswer() {
            const oProvModel = this.getView().getModel("provData");
            const sAccountType = oProvModel.getProperty("/AccType");

            if (!sAccountType?.trim()) {
                MessageBox.alert(this._getText("adminEE.emptyInput"));
                return;
            }

            const bConfirmed = await this._confirmSave();

            if (!bConfirmed) {
                return;
            }

            await this._saveSupplierData();
        },

        _confirmSave() {
            return new Promise((resolve) => {
                MessageBox.warning(
                    this._getText("adminEE.saveWarningMessage"),
                    {
                        title: this._getText("adminEE.saveWarningTitle"),
                        actions: [
                            MessageBox.Action.YES,
                            MessageBox.Action.NO
                        ],
                        emphasizedAction: MessageBox.Action.YES,
                        onClose: (sAction) => {
                            resolve(
                                sAction === MessageBox.Action.YES
                            );
                        }
                    }
                );
            });
        },

        async _saveSupplierData() {
            try {
                this._setBusy(true);

                const oProvModel = this.getView().getModel("provData");
                const oSupplierModel = this.getView().getModel("supplierData");
                const oServiceModel = this.getView().getModel("expedientAdminService");

                if (!oServiceModel) {
                    throw new Error(
                        "The expedient admin service model is not available."
                    );
                }

                const sCompanyCode = oSupplierModel.getProperty("/CompanyCode");
                const sBusinessPartner = oSupplierModel.getProperty("/BusinessPartner");

                const iGroupId = Number(oProvModel.getProperty("/AccTypeId"));

                if (!sCompanyCode || !sBusinessPartner || !iGroupId) {
                    throw new Error(
                        this._getText(
                            "adminEE.invalidSupplierGroupData"
                        )
                    );
                }

                const oOperation =
                    oServiceModel.bindContext(
                        "/CreateExpedientGroupRelation(...)"
                    );

                oOperation.setParameter("companyCode", sCompanyCode);
                oOperation.setParameter("businessPartner", sBusinessPartner);
                oOperation.setParameter("groupId", iGroupId);

                await oOperation.execute();

                const oRelation =
                    await this._loadSupplierGroupRelation(
                        sCompanyCode,
                        sBusinessPartner
                    );

                if (oRelation) {
                    await this._loadGroupDocuments(
                        oRelation.GroupId,
                        sBusinessPartner
                    );
                }

                MessageToast.show(
                    this._getText(
                        "adminEE.saveSuccess"
                    )
                );

            } catch (oError) {
                this._handleError(oError);
            } finally {
                this._setBusy(false);
            }
        },

        async onChangeFUP(oEvent) {
            const oFile = oEvent.getParameter("files")?.[0];

            if (!oFile) {
                return;
            }

            const oUploader = oEvent.getSource();
            const oContext = oUploader.getBindingContext("supplierDocs");

            if (!oContext) {
                return;
            }

            const oDocument = oContext.getObject();

            try {
                this._setBusy(true);
                await this._openUploadProgressDialog();
                const oResult = await this._createFile(oFile, oDocument);
                this._updateDocumentFromUpload(oDocument, oResult);
                this._updateFileCounters();
                await this._showUploadCompleted();
            } catch (oError) {
                this._showUploadError();
                this._handleError(oError);
            } finally {
                this._setBusy(false);
            }
        },

        _updateDocumentFromUpload(oDocument, oResult) {
            const oFile = oResult?.value?.[0];

            if (!oFile) {
                throw new Error(
                    this._getText(
                        "adminEE.uploadResponseError"
                    )
                );
            }

            this._updateDocumentState(
                oDocument,
                {
                    FileName: oFile.FileName,
                    MimeType: oFile.MimeType,
                    FileSize: oFile.FileSize,
                    Status: oFile.Status,
                    ValidUntil: oFile.ValidUntil,
                    StatusIcon: "sap-icon://document-text",
                    StatusText: this._getStatusText(oFile.Status || "MI"),
                    RowHighlight: this._getStatusHighlight(
                        oFile.Status || "MI"
                    ),
                    MsjError: "",
                    deleteable: true,
                    upLoadEnabled: false
                }
            );
        },

        async _loadGroupDocuments(iGroupId, sBusinessPartner) {
            const oAdminModel = this.getView().getModel("expedientAdminService");

            if (!oAdminModel) {
                throw new Error(
                    "The expedient admin service model is not available."
                );
            }

            const oOperation = oAdminModel.bindContext("/GetDocumentsAssignmentByGroup(...)");
            oOperation.setParameter("groupId", Number(iGroupId));
            await oOperation.execute();

            const oResult =
                oOperation
                    .getBoundContext()
                    .getObject();

            const aGroupDocuments =
                (oResult?.value ?? []).filter(
                    (oDocument) =>
                        oDocument.Selected === "X"
                );

            const aSupplierFiles =
                await this._loadSupplierFiles(
                    sBusinessPartner
                );

            const oFilesByDocumentId =
                new Map(
                    aSupplierFiles.map(
                        (oFile) => [
                            String(oFile.DocumentId),
                            oFile
                        ]
                    )
                );

            const aDocuments =
                aGroupDocuments.map(
                    (oDocument) => {
                        const oFile =
                            oFilesByDocumentId.get(
                                String(
                                    oDocument.DocumentId
                                )
                            );

                        return {
                            ...oDocument,
                            FileName: oFile?.FileName || "",
                            MimeType: oFile?.MimeType || "",
                            FileSize: oFile?.FileSize || 0,
                            Status: oFile?.Status || "MI",
                            ValidUntil: oFile?.ValidUntil || "",

                            StatusIcon:
                                oFile
                                    ? "sap-icon://document-text"
                                    : "sap-icon://document",

                            StatusText: this._getStatusText(oFile?.Status || "MI"),

                            RowHighlight:
                                this._getStatusHighlight(
                                    oFile?.Status || "MI"
                                ),

                            MsjError: "",
                            deleteable: Boolean(oFile),
                            upLoadEnabled: !oFile
                        };
                    }
                );

            this.getView()
                .getModel("supplierDocs")
                .setProperty(
                    "/documentItem",
                    aDocuments
                );

            this._updateFileCounters();

            return aDocuments;
        },

        async _loadSupplierFiles(sBusinessPartner) {
            const oModel =
                this.getView().getModel("expedientFilesService");

            if (!oModel) {
                throw new Error(
                    "The expedient files service model is not available."
                );
            }

            const oOperation =
                oModel.bindContext("/GetFiles(...)");

            oOperation.setParameter(
                "businessPartner",
                sBusinessPartner
            );

            await oOperation.execute();

            const oResult =
                oOperation
                    .getBoundContext()
                    .getObject();

            return oResult?.value ?? [];
        },

        async _createFile(oFile, oDocument) {
            const oModel =
                this.getView().getModel("expedientFilesService");

            if (!oModel) {
                throw new Error(
                    "The expedient files service model is not available."
                );
            }

            const oSupplier =
                this.getView()
                    .getModel("supplierData")
                    .getData();

            const sFileBase64 =
                await this._readFileAsBase64(oFile);

            const oItem = {
                rfc: oSupplier.TaxNumber1,
                groupId: Number(
                    this.getView()
                        .getModel("provData")
                        .getProperty("/AccTypeId")
                ),
                documentId: Number(oDocument.DocumentId),
                companyCode: oSupplier.CompanyCode,
                businessPartner: String(
                    oSupplier.BusinessPartner
                ),
                fileName: oFile.name,
                validUntil: null,
                fileBase64: sFileBase64
            };

            const oOperation =
                oModel.bindContext(
                    "/CreateFile(...)"
                );

            oOperation.setParameter(
                "items",
                [oItem]
            );

            await oOperation.execute();

            return (
                oOperation
                    .getBoundContext()
                    .getObject()
            );
        },

        async onViewDocument(oEvent) {
            const oLink = oEvent.getSource();

            const oContext =
                oLink.getBindingContext("supplierDocs");

            if (!oContext) {
                return;
            }

            const oDocument =
                oContext.getObject();

            try {
                this._setBusy(true);

                const oResult = await this._downloadPDF(oDocument);
                const oFile = oResult?.value?.[0];

                if (!oFile?.success || !oFile.fileBase64) {
                    throw new Error(oFile?.message || this._getText("adminEE.documentDownloadError")
                    );
                }

                this._openPDF(oFile.fileBase64, oFile.fileName);

            } catch (oError) {
                this._handleError(oError);
            } finally {
                this._setBusy(false);
            }
        },

        async _downloadPDF(oDocument) {
            const oModel =
                this.getView().getModel(
                    "objectStoreService"
                );

            if (!oModel) {
                throw new Error(
                    "The object store service model is not available."
                );
            }

            const oSupplier =
                this.getView()
                    .getModel("supplierData")
                    .getData();

            const oOperation =
                oModel.bindContext(
                    "/downloadPDF(...)"
                );

            oOperation.setParameter(
                "items",
                [
                    {
                        companyCode: oSupplier.CompanyCode,
                        businessPartner: String(
                            oSupplier.BusinessPartner
                        ),
                        documentid: Number(
                            oDocument.DocumentId
                        ),
                        fileName: oDocument.FileName
                    }
                ]
            );

            await oOperation.execute();

            return oOperation
                .getBoundContext()
                .getObject();
        },

        _openPDF(sFileBase64, sFileName) {
            if (!this._oPDFViewer) {
                this._oPDFViewer = new PDFViewer({
                    title: sFileName || "PDF",
                    displayType: "Embedded",
                    showDownloadButton: true
                });

                this.getView().addDependent(
                    this._oPDFViewer
                );
            }

            if (this._sPDFBlobUrl) {
                URL.revokeObjectURL(
                    this._sPDFBlobUrl
                );

                this._sPDFBlobUrl = null;
            }

            const sBinaryString =
                window.atob(sFileBase64);

            const aBytes =
                new Uint8Array(
                    sBinaryString.length
                );

            for (
                let i = 0;
                i < sBinaryString.length;
                i++
            ) {
                aBytes[i] =
                    sBinaryString.charCodeAt(i);
            }

            const oBlob =
                new Blob(
                    [aBytes],
                    {
                        type: "application/pdf"
                    }
                );

            this._sPDFBlobUrl =
                URL.createObjectURL(oBlob);

            this._oPDFViewer.setSource(
                this._sPDFBlobUrl
            );

            this._oPDFViewer.open();
        },

        /**
         * Converts a File into Base64.
         */
        _readFileAsBase64(oFile) {
            return new Promise((resolve, reject) => {
                const oReader = new FileReader();

                oReader.onload = () => {
                    const sResult = oReader.result;
                    const sBase64 = sResult.split(",")[1];

                    resolve(sBase64);
                };

                oReader.onerror = () => {
                    reject(
                        new Error(
                            this._getText("adminEE.fileReadError")
                        )
                    );
                };

                oReader.readAsDataURL(oFile);
            });
        },

        handleTypeMissmatch(oEvent) {
            const sFileType =
                oEvent.getParameter(
                    "fileType"
                );

            MessageToast.show(
                `${this._getText(
                    "adminEE.invalidFileType"
                )} ${sFileType}`
            );
        },

        _updateDocumentState(
            oDocument,
            oChanges
        ) {
            const oModel =
                this.getView().getModel(
                    "supplierDocs"
                );

            const aDocuments =
                oModel.getProperty(
                    "/documentItem"
                ) || [];

            const iIndex =
                aDocuments.indexOf(
                    oDocument
                );

            if (iIndex === -1) {
                return;
            }

            Object.entries(
                oChanges
            ).forEach(
                ([sProperty, vValue]) => {
                    oModel.setProperty(
                        `/documentItem/${iIndex}/${sProperty}`,
                        vValue
                    );
                }
            );
        },

        /**
         * Updates document counters.
         */
        _updateFileCounters() {
            const oModel =
                this.getView().getModel("supplierDocs");

            const aDocuments =
                oModel.getProperty(
                    "/documentItem"
                ) || [];

            const iRequired =
                aDocuments.filter(
                    (oDocument) =>
                        oDocument.Optional !== "X"
                ).length;

            const iUploaded = aDocuments.length;
            const oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/filesRequired", iRequired);
            oViewModel.setProperty("/filesUploaded", iUploaded);
        },

        /**
         * Handles delete confirmation.
         */
        async onDeleteRowPress(oEvent) {
            const oContext =
                oEvent.getSource()
                    .getBindingContext(
                        "supplierDocs"
                    );

            if (!oContext) {
                return;
            }

            const oDocument =
                oContext.getObject();

            const bConfirmed =
                await this._confirm(
                    this._getText(
                        "adminEE.confirmDelete"
                    ),
                    this._getText(
                        "adminEE.warning"
                    )
                );

            if (!bConfirmed) {
                return;
            }

            await this._deleteDocument(
                oDocument
            );
        },

        async _deleteDocument(oDocument) {
            try {
                this._setBusy(true);

                const oModel =
                    this.getView().getModel(
                        "expedientFilesService"
                    );

                if (!oModel) {
                    throw new Error(
                        "The expedient files service model is not available."
                    );
                }

                const oSupplier =
                    this.getView()
                        .getModel("supplierData")
                        .getData();

                const iGroupId = Number(
                    this.getView()
                        .getModel("provData")
                        .getProperty("/AccTypeId")
                );

                const oOperation = oModel.bindContext("/DeleteFile(...)");

                oOperation.setParameter(
                    "items",
                    [
                        {
                            rfc: oSupplier.TaxNumber1,
                            groupId: iGroupId,
                            documentId: Number(oDocument.DocumentId),
                            companyCode: oSupplier.CompanyCode,
                            businessPartner: String(oSupplier.BusinessPartner),
                            fileName: oDocument.FileName
                        }
                    ]
                );

                await oOperation.execute();

                this._updateDocumentState(
                    oDocument,
                    {
                        FileName: "",
                        MimeType: "",
                        FileSize: 0,
                        Status: "MI",
                        ValidUntil: "",
                        StatusIcon: "sap-icon://document",
                        StatusText: this._getStatusText("MI"),
                        RowHighlight: "None",
                        MsjError: "",
                        deleteable: false,
                        upLoadEnabled: true
                    }
                );

                this._updateFileCounters();
                MessageToast.show(this._getText("adminEE.deleteSuccess"));

            } catch (oError) {
                this._handleError(oError);
            } finally {
                this._setBusy(false);
            }
        },

        /**
         * Navigates back.
         */
        onNavBack() {
            const oHistory =
                History.getInstance();

            const sPreviousHash =
                oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
                return;
            }

            UIComponent
                .getRouterFor(this)
                .navTo(
                    "Routemain",
                    {},
                    true
                );
        },

        /**
         * Sets page busy state.
         */
        _setBusy(bBusy) {
            this.getView().setBusy(
                bBusy
            );
        },

        _confirm(
            sMessage,
            sTitle
        ) {
            return new Promise(
                (resolve) => {
                    MessageBox.confirm(
                        sMessage,
                        {
                            title: sTitle,
                            actions: [
                                MessageBox.Action.YES,
                                MessageBox.Action.NO
                            ],
                            emphasizedAction:
                                MessageBox.Action.YES,

                            onClose:
                                (sAction) => {
                                    resolve(
                                        sAction ===
                                        MessageBox.Action.YES
                                    );
                                }
                        }
                    );
                }
            );
        },

        _getText(sKey) {
            return this.getView()
                .getModel("i18n")
                .getResourceBundle()
                .getText(sKey);
        },

        _handleError(oError) {
            console.error(
                "expedientefront:",
                oError
            );

            const sMessage =
                oError?.message ||
                this._getText(
                    "adminEE.genericError"
                );

            MessageBox.error(
                sMessage
            );
        },

        _getStatusText(sStatus) {
            switch (sStatus) {
                case "MI":
                    return "Sin documento";
                case "CR":
                case "UP":
                    return "Pendiente";
                case "EX":
                    return "Expirado";
                case "AP":
                    return "Aprobado";
                case "RJ":
                    return "Rechazado";
                default:
                    return "Sin documento";
            }
        },

        _getStatusHighlight(sStatus) {
            switch (sStatus) {
                case "CR":
                case "UP":
                    return "Information";

                case "EX":
                    return "Warning";

                case "AP":
                    return "Success";

                case "RJ":
                    return "Error";

                case "MI":
                default:
                    return "None";
            }
        },

        formatSupplier(sSupplierName, sSupplier) {
            return `${sSupplier} - ${sSupplierName}`;
        },

        formatAccountType(sId, sDescription) {
            if (!sId && !sDescription) {
                return "";
            }

            return `${sId} - ${sDescription}`;
        },

        formatOptional(sOptional) {
            return sOptional === "X";
        },

        onExit() {
            this._oUploadProgressDialog?.destroy();
            this._oPDFViewer?.destroy();

            if (this._sPDFBlobUrl) {
                URL.revokeObjectURL(
                    this._sPDFBlobUrl
                );
                this._sPDFBlobUrl = null;
            }

            this._oUploadProgressDialog = null;
            this._oPDFViewer = null;
        }
    });
});