"use strict";
if (typeof process !== "undefined") {
    //node env
    const wrtc = require('wrtc');
    global.RTCPeerConnection = wrtc.RTCPeerConnection;
}
;
//# sourceMappingURL=platform.js.map