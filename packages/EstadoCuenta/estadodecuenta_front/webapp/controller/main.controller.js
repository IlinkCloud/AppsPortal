sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/core/BusyIndicator",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/Sorter",
  "sap/ui/core/format/DateFormat"
], (Controller, JSONModel, Filter, BusyIndicator, FilterOperator, Sorter, DateFormat) => {
  "use strict";
  //  const fnFormat = (d) => d.toISOString().split("T")[0]; CSF
  const fnFormat = (d) => {
    if (!d) return null;

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };
  return Controller.extend("estadodecuentafront.controller.main", {
    onInit: function () {
      this.oODataJSONModel = new JSONModel();
      this.SearchF = "";
      this.SearchVal = "";
      this.FechaIni = null;
      this.FechaFin = null;
      this.oTotalesModel = new JSONModel({
        fechaHoy: "",
        saldo: 0,
        moneda: "MXN"
      });
      this.getView().setModel(this.oTotalesModel, "totales");
      this.getView().addEventDelegate({
        onBeforeShow: () => {
          const hoy = new Date();
          const desde = new Date(hoy.getFullYear(), 0, 1);
          this.FechaIni = desde;
          this.FechaFin = hoy;
          this.getStatements(fnFormat(desde), fnFormat(hoy));
        }
      });
    },

    getStatements: function (sDateFrom, sDateTo) {
      /*
      let finalDate = sDateTo ? new Date(sDateTo) : new Date();
      const currentYear = finalDate.getFullYear();
      let initDate = new Date(currentYear, 0, 1);
      BusyIndicator.show(100);
      const url = `/odata/v4/account-statement/AccountStatement?initDate=${fnFormat(initDate)}&finalDate=${fnFormat(finalDate)}`;
      console.log("URL llamada:", url);
      */
      const hoy = new Date();

      const initDate = sDateFrom
        ? sDateFrom
        : fnFormat(new Date(hoy.getFullYear(), 0, 1));

      const finalDate = sDateTo
        ? sDateTo
        : fnFormat(hoy);

      BusyIndicator.show(100);

      const url = `/odata/v4/account-statement/AccountStatement?initDate=${initDate}&finalDate=${finalDate}`;
      console.log("URL llamada:", url);
      fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json" },

        credentials: "include"
      })
        .then(r => r.ok ? r.json() : r.text().then(t => { throw new Error(`HTTP ${r.status} - ${t}`); }))
        .then(data => {
          console.log("Respuesta API facturas:", data);
          this.oODataJSONModel.setData({ facturas: data.value || [] });
          this.getOwnerComponent().setModel(this.oODataJSONModel, "facturas");
          const hoy = new Date();
          const fechaHoy = hoy.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
          let saldos = {};
          (data.value || []).forEach(f => {
            if (!f.IsCleared) {
              const monto = parseFloat(f.SupplierInvoiceItemAmount || 0);
              const moneda = f.DocumentCurrency || "MXN";
              if (!isNaN(monto)) {
                saldos[moneda] = (saldos[moneda] || 0) + monto;
              }
            }
          });
          const saldoTexto = Object.entries(saldos)
            .map(([mon, val]) => `${val.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${mon}`)
            .join(" | ");
          this.oTotalesModel.setData({
            fechaHoy,
            saldo: saldoTexto,
            moneda: ""
          });
          const oTable = this.byId("cuentasTable");
          const oBinding = oTable.getBinding("items");
          if (oBinding) {
            const oSorter = new Sorter("IsCleared", false, function (oContext) {
              return {
                key: oContext.getProperty("IsCleared"),
                text: oContext.getProperty("IsCleared") ? "Pagadas" : "Pendientes"
              };
            });
            oBinding.sort(oSorter);
          }
        })
        .catch(error => console.error("Error:", error))
        .finally(() => {
          BusyIndicator.hide();
        });
    },

    onDateRangeChange: function (oEvent) {
      const dFrom = oEvent.getSource().getDateValue();
      const dTo = oEvent.getSource().getSecondDateValue();
      if (!dFrom || !dTo) return;
      this.FechaIni = dFrom;
      this.FechaFin = dTo;
      this.getStatements(fnFormat(dFrom), fnFormat(dTo));
    },

    formatStatus: function (bCleared) {
      return bCleared ? "Pagada" : "Pendiente";
    },

    //  ACTUALIZADO: Controla el Número SAP según si es Factura o Pago
    formatNumeroSAP: function (bCleared, supplierInvoice, clearingDoc, docType) {
      // Si es la fila de Factura (RE), mostrar el número de factura
      if (docType === 'RE') {
        return supplierInvoice || "";
      }
      // Si es la fila de Pago (KZ/ZP), mostrar el documento de pago
      else {
        return clearingDoc || "";
      }
    },

    //  NUEVO: Controla la columna "Factura"
    formatFacturaDisplay: function (supplierInvoice, docType) {
      // Si es la fila de Factura (RE), dejar vacío
      if (docType === 'RE') {
        return "";
      }
      // Si es la fila de Pago, mostrar la factura a la que corresponde
      return supplierInvoice || "";
    },

    formatTipoDocumentoPorEstatus: function (bCleared, tipo, documentType, tipoTexto) {
      if (tipoTexto) return tipoTexto;

      if (documentType === "NC") return "NOTA DE CRÉDITO";
      if (documentType === "RE") return "FACTURA";
      if (documentType === "KZ" || documentType === "ZP") return "PAGO";

      if (bCleared) return "PAGO";
      return "FACTURA";
    },

    onRadioSelectionChange: function (oEvent) {
      const selectedIndex = oEvent.getParameter("selectedIndex");
      const oTable = this.byId("cuentasTable");
      const oBinding = oTable.getBinding("items");
      const oDateRange = this.byId("dateRange");
      if (!oBinding) return;
      let aFilters = [];
      switch (selectedIndex) {
        case 0: // Pendientes
          aFilters.push(new Filter("IsCleared", FilterOperator.EQ, false));
          oBinding.filter(aFilters);
          oDateRange.setVisible(false);
          break;
        case 1: // Pagadas
          aFilters.push(new Filter("IsCleared", FilterOperator.EQ, true));
          oBinding.filter(aFilters);
          oDateRange.setVisible(false);
          break;
        case 2: // Todos
          oBinding.filter([]);
          oDateRange.setVisible(true);
          break;
      }
    },

    onSearch: function (oEvent) {
      const sQuery = oEvent.getParameter("newValue") || oEvent.getSource().getValue();
      const sKey = this.byId("_IDGenSelect").getSelectedKey();
      const oTable = this.byId("cuentasTable");
      const oBinding = oTable.getBinding("items");
      if (!oBinding) return;
      let aFilters = [];
      if (sQuery) {
        aFilters.push(new Filter(sKey, FilterOperator.Contains, sQuery));
      }
      oBinding.filter(aFilters);
    },

    /*
    onDateRangeChange: function (oEvent) {
      const oDateRange = oEvent.getSource();
      const dFrom = oDateRange.getDateValue();
      const dTo = oDateRange.getSecondDateValue();
      if (!dFrom || !dTo) return;
      this.FechaIni = dFrom;
      this.FechaFin = dTo;
      //const fnFormat = (d) => d.toISOString().split("T")[0];
      this.getStatements(fnFormat(dFrom), fnFormat(dTo));
    },
    */

    formatStatusState: function (bCleared) {
      return bCleared ? "Success" : "Error";
    },

    formatTipoDocumento: function (tipo, tipoTexto) {
      if (tipoTexto) return tipoTexto;

      if (tipo === "ZP" || tipo === "KZ") return "PAGO";
      if (tipo === "NC") return "NOTA DE CRÉDITO";
      if (tipo === "RE") return "FACTURA";

      return tipo || "";
    },

    establecePeriodo: function () {
      if (!this.oCalendarPopover) {
        const oDateRange = new sap.m.DateRangeSelection("calendarPopup", {
          displayFormat: "yyyy-MM-dd",
          delimiter: " - "
        });
        const oButton = new sap.m.Button({
          text: "Consultar",
          type: "Emphasized",
          press: () => {
            const dFrom = oDateRange.getDateValue();
            const dTo = oDateRange.getSecondDateValue();
            //const fnFormat = (d) => d.toISOString().split("T")[0];
            if (dFrom && dTo) {
              this.getStatements(fnFormat(dFrom), fnFormat(dTo));
            } else {
              const hoy = new Date();
              this.getStatements(null, fnFormat(hoy));
            }
            this.oCalendarPopover.close();
          }
        });
        this.oCalendarPopover = new sap.m.Popover({
          title: "Seleccione Período de Consulta",
          contentWidth: "300px",
          content: [oDateRange, oButton],
          placement: sap.m.PlacementType.Bottom,
          showHeader: true
        });
      }
      const oButton = this.byId("bConsultarEC");
      this.oCalendarPopover.openBy(oButton);
    },


    onSapNumberPress: async function (oEvent) {
      const oContext = oEvent.getSource().getBindingContext("facturas");
      const oData = oContext.getObject();

      // Solo mostrar si está pagada
      if (!oData.IsCleared) {
        sap.m.MessageToast.show("Este documento no está pagado, no hay datos que mostrar.");
        return;
      }

      // 1. Intentar usar el UUID que ya viene del backend (vinculado a la Factura RE)
      let uuidValue = oData.UUID || "";

      // 2. Fallback: Consultar UUID desde la API si no viene del backend
      if (!uuidValue) {
        try {
          // Nota: Esto suele fallar para líneas de Pago porque el UUID está en la Factura (RE), no en el Pago (KZ)
          const response = await fetch(
            "/sap/opu/odata/sap/YY1_UUID_CDS/YY1_UUID?$format=json&$filter=AccountingDocument eq '" +
            (oData.ClearingAccountingDocument || oData.AccountingDocument) +
            "' and FiscalYear eq '" + (new Date().getFullYear()) + "'", {
            method: "GET",
            headers: { "Accept": "application/json" },

            credentials: "include"
          }
          );
          if (response.ok) {
            const result = await response.json();
            const uuids = result?.d?.results?.filter(u => u.JrnlEntryCntrySpecificRef1?.trim()) || [];
            uuidValue = uuids[0]?.JrnlEntryCntrySpecificRef1 || "";
          }
        } catch (err) {
          console.error("Error consultando UUID:", err);
        }
      }

      // Construir datos para la tabla del diálogo
      // Se agregaron más fallbacks para Reference (Referencia de Factura, Documento Material, etc.)
      const detalle = [{
        SupplierInvoice: oData.SupplierInvoice,
        UUID: uuidValue,
        Reference: oData.DocumentReferenceID || oData.SupplierInvoiceIDByInvcgParty || oData.ReferenceDocument || oData.AssignmentReference || "",
        FechaFactura: oData.ClearingCreationDate || oData.DocumentDate,
        Importe: oData.AmountInTransactionCurrency || oData.NetPaymentAmount,
        Moneda: oData.TransactionCurrency || oData.DocumentCurrency
      }];

      const oModel = new sap.ui.model.json.JSONModel({ detalle });

      if (!this.oFacturaDialog) {
        this.oFacturaDialog = new sap.m.Dialog({
          title: "Detalle de Pago",
          contentWidth: "600px",
          contentHeight: "400px",
          resizable: true,
          draggable: true,
          content: [
            new sap.m.Table({
              columns: [
                new sap.m.Column({ header: new sap.m.Text({ text: "Num. de Factura" }) }),
                new sap.m.Column({ header: new sap.m.Text({ text: "UUID" }) }),
                new sap.m.Column({ header: new sap.m.Text({ text: "Referencia" }) }),
                new sap.m.Column({ header: new sap.m.Text({ text: "Fecha de Factura" }) }),
                new sap.m.Column({ header: new sap.m.Text({ text: "Importe" }) })
              ],
              items: {
                path: "detalle>/detalle",
                template: new sap.m.ColumnListItem({
                  cells: [
                    new sap.m.Text({ text: "{detalle>SupplierInvoice}" }),
                    new sap.m.Text({ text: "{detalle>UUID}" }),
                    new sap.m.Text({ text: "{detalle>Reference}" }),
                    new sap.m.Text({ text: "{detalle>FechaFactura}" }),
                    new sap.m.ObjectNumber({
                      number: "{detalle>Importe}",
                      unit: "{detalle>Moneda}"
                    })
                  ]
                })
              }
            })
          ],
          endButton: new sap.m.Button({
            text: "Cerrar",
            press: () => this.oFacturaDialog.close()
          })
        });
        this.getView().addDependent(this.oFacturaDialog);
      }

      this.oFacturaDialog.setModel(oModel, "detalle");
      this.oFacturaDialog.open();
    },

    formatDate: function (v) {
      if (!v) return "";
      const date = new Date(v);
      if (isNaN(date.getTime())) return "";
      const oDateFormat = DateFormat.getDateInstance({ pattern: "dd-MM-yyyy" });
      return oDateFormat.format(date);
    },

    formatDateSimple: function (v) {
      if (!v) return "";
      const parts = v.split("-");
      if (parts.length !== 3) return "";
      const date = new Date(parts[0], parts[1] - 1, parts[2]);
      if (isNaN(date.getTime())) return "";
      const oDateFormat = DateFormat.getDateInstance({ pattern: "d MMM yyyy" });
      return oDateFormat.format(date);
    },

  });
});