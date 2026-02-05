sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/core/BusyIndicator",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/Sorter"
], (Controller, JSONModel, Filter, BusyIndicator, FilterOperator, Sorter) => {
  "use strict";

  const fnFormat = (d) => d.toISOString().split("T")[0];
  const daysBackDefault = 60;

  function subtractDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() - days);
    return d;
  }

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
          const desde = subtractDays(hoy, daysBackDefault);
          this.FechaIni = desde;
          this.FechaFin = hoy;
          this.getStatements(fnFormat(desde), fnFormat(hoy));
        }
      });
    },

    getStatements: function (sDateFrom, sDateTo) {
      let finalDate = sDateTo ? new Date(sDateTo) : new Date();
      let initDate = sDateFrom ? new Date(sDateFrom) : subtractDays(finalDate, daysBackDefault);
      BusyIndicator.show(100);

      const url = `/odata/v4/account-statement/AccountStatement?initDate=${fnFormat(initDate)}&finalDate=${fnFormat(finalDate)}`;
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

          let saldo = 0;
          (data.value || []).forEach(f => {
            if (!f.IsCleared) {
              saldo += parseFloat(f.AmountInTransactionCurrency || 0);
            }
          });

          this.oTotalesModel.setData({
            fechaHoy,
            saldo,
            moneda: (data.value && data.value[0]?.DocumentCurrency) || "MXN"
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

    formatNumeroSAP: function (bCleared, supplierInvoice, clearingDoc) {
      if (bCleared) {
        return clearingDoc || "";   // si está pagada, mostrar ClearingAccountingDocument
      } else {
        return supplierInvoice || ""; // si está pendiente, mostrar SupplierInvoice
      }
    },

    formatTipoDocumentoPorEstatus: function (bCleared, tipo) {
      if (bCleared) {
        return "PAGO";
      } else {
        return "FACTURA";
      }
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
          oDateRange.setVisible(false); // ocultar calendario
          break;
        case 1: // Pagadas
          aFilters.push(new Filter("IsCleared", FilterOperator.EQ, true));
          oBinding.filter(aFilters);
          oDateRange.setVisible(false); // ocultar calendario
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

    onDateRangeChange: function (oEvent) {
      const oDateRange = oEvent.getSource();
      const dFrom = oDateRange.getDateValue();
      const dTo = oDateRange.getSecondDateValue();

      if (!dFrom || !dTo) return;

      this.FechaIni = dFrom;
      this.FechaFin = dTo;

      const fnFormat = (d) => d.toISOString().split("T")[0];
      this.getStatements(fnFormat(dFrom), fnFormat(dTo));
    },

    formatStatusState: function (bCleared) {
      return bCleared ? "Success" : "Error";
    },

    formatTipoDocumento: function (tipo) {
      if (tipo === "ZP" || tipo === "KZ") return "PAGO";
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
            const fnFormat = (d) => d.toISOString().split("T")[0];

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

      // Consultar UUID desde la CDS usando AccountingDocument
      let uuidValue = "";
      let detalle = [];
      try {
        const response = await fetch(
          "/sap/opu/odata/sap/YY1_UUID_CDS/YY1_UUID?$filter=AccountingDocument eq '" + oData.SupplierInvoice + "'",
          {
            method: "GET",
            headers: { "Accept": "application/json" },
            credentials: "include"
          }
        );

        if (response.ok) {
          const result = await response.json();
          uuidValue = result?.d?.results?.[0]?.JrnlEntryCntrySpecificRef1 || "";
        } else {
          console.warn("UUID no encontrado para documento:", oData.AccountingDocument);
          uuidValue = "";
        }
      } catch (err) {
        console.error("Error consultando UUID:", err);
        uuidValue = "";
      }

      // Construir datos para la tabla del diálogo
      detalle = [{
        SupplierInvoice: oData.SupplierInvoice,
        UUID: uuidValue,
        Reference: oData.DocumentReferenceID,
        FechaFactura: oData.ClearingCreationDate,
        Importe: oData.AmountInTransactionCurrency,
        Moneda: oData.TransactionCurrency
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
    }

  });
});