sap.ui.define([
    "sap/ui/core/UIComponent",
    "mispedidosfront/model/models"
], (UIComponent, models) => {
    "use strict";

    return UIComponent.extend("mispedidosfront.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // enable routing
            this.getRouter().initialize();

            // Inicia keep-alive
            this._startKeepAlive();
        },
        _startKeepAlive: function () {
            this._keepAliveInterval = setInterval(() => {
                fetch("/odata/v4/invitacion/$metadata", {
                    credentials: "same-origin"
                }).catch(() => {
                });
            }, 5 * 60 * 1000); // cada 5 minutos
        }
    });
});