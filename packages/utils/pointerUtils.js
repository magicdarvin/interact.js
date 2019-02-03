import browser from './browser';
import dom from './domObjects';
import * as domUtils from './domUtils';
import hypot from './hypot';
import * as is from './is';
import pointerExtend from './pointerExtend';
const pointerUtils = {
    copyCoords(dest, src) {
        dest.page = dest.page || {};
        dest.page.x = src.page.x;
        dest.page.y = src.page.y;
        dest.client = dest.client || {};
        dest.client.x = src.client.x;
        dest.client.y = src.client.y;
        dest.timeStamp = src.timeStamp;
    },
    setCoordDeltas(targetObj, prev, cur) {
        targetObj.page.x = cur.page.x - prev.page.x;
        targetObj.page.y = cur.page.y - prev.page.y;
        targetObj.client.x = cur.client.x - prev.client.x;
        targetObj.client.y = cur.client.y - prev.client.y;
        targetObj.timeStamp = cur.timeStamp - prev.timeStamp;
    },
    setCoordVelocity(targetObj, delta) {
        const dt = Math.max(delta.timeStamp / 1000, 0.001);
        targetObj.page.x = delta.page.x / dt;
        targetObj.page.y = delta.page.y / dt;
        targetObj.client.x = delta.client.x / dt;
        targetObj.client.y = delta.client.y / dt;
        targetObj.timeStamp = dt;
    },
    isNativePointer(pointer) {
        return (pointer instanceof dom.Event || pointer instanceof dom.Touch);
    },
    // Get specified X/Y coords for mouse or event.touches[0]
    getXY(type, pointer, xy) {
        xy = xy || {};
        type = type || 'page';
        xy.x = pointer[type + 'X'];
        xy.y = pointer[type + 'Y'];
        return xy;
    },
    getPageXY(pointer, page) {
        page = page || { x: 0, y: 0 };
        // Opera Mobile handles the viewport and scrolling oddly
        if (browser.isOperaMobile && pointerUtils.isNativePointer(pointer)) {
            pointerUtils.getXY('screen', pointer, page);
            page.x += window.scrollX;
            page.y += window.scrollY;
        }
        else {
            pointerUtils.getXY('page', pointer, page);
        }
        return page;
    },
    getClientXY(pointer, client) {
        client = client || {};
        if (browser.isOperaMobile && pointerUtils.isNativePointer(pointer)) {
            // Opera Mobile handles the viewport and scrolling oddly
            pointerUtils.getXY('screen', pointer, client);
        }
        else {
            pointerUtils.getXY('client', pointer, client);
        }
        return client;
    },
    getPointerId(pointer) {
        return is.number(pointer.pointerId) ? pointer.pointerId : pointer.identifier;
    },
    setCoords(targetObj, pointers, timeStamp) {
        const pointer = (pointers.length > 1
            ? pointerUtils.pointerAverage(pointers)
            : pointers[0]);
        const tmpXY = {};
        pointerUtils.getPageXY(pointer, tmpXY);
        targetObj.page.x = tmpXY.x;
        targetObj.page.y = tmpXY.y;
        pointerUtils.getClientXY(pointer, tmpXY);
        targetObj.client.x = tmpXY.x;
        targetObj.client.y = tmpXY.y;
        targetObj.timeStamp = is.number(timeStamp) ? timeStamp : new Date().getTime();
    },
    pointerExtend,
    getTouchPair(event) {
        const touches = [];
        // array of touches is supplied
        if (is.array(event)) {
            touches[0] = event[0];
            touches[1] = event[1];
        }
        // an event
        else {
            if (event.type === 'touchend') {
                if (event.touches.length === 1) {
                    touches[0] = event.touches[0];
                    touches[1] = event.changedTouches[0];
                }
                else if (event.touches.length === 0) {
                    touches[0] = event.changedTouches[0];
                    touches[1] = event.changedTouches[1];
                }
            }
            else {
                touches[0] = event.touches[0];
                touches[1] = event.touches[1];
            }
        }
        return touches;
    },
    pointerAverage(pointers) {
        const average = {
            pageX: 0,
            pageY: 0,
            clientX: 0,
            clientY: 0,
            screenX: 0,
            screenY: 0,
        };
        for (const pointer of pointers) {
            for (const prop in average) {
                average[prop] += pointer[prop];
            }
        }
        for (const prop in average) {
            average[prop] /= pointers.length;
        }
        return average;
    },
    touchBBox(event) {
        if (!event.length &&
            !(event.touches &&
                event.touches.length > 1)) {
            return null;
        }
        const touches = pointerUtils.getTouchPair(event);
        const minX = Math.min(touches[0].pageX, touches[1].pageX);
        const minY = Math.min(touches[0].pageY, touches[1].pageY);
        const maxX = Math.max(touches[0].pageX, touches[1].pageX);
        const maxY = Math.max(touches[0].pageY, touches[1].pageY);
        return {
            x: minX,
            y: minY,
            left: minX,
            top: minY,
            width: maxX - minX,
            height: maxY - minY,
        };
    },
    touchDistance(event, deltaSource) {
        const sourceX = deltaSource + 'X';
        const sourceY = deltaSource + 'Y';
        const touches = pointerUtils.getTouchPair(event);
        const dx = touches[0][sourceX] - touches[1][sourceX];
        const dy = touches[0][sourceY] - touches[1][sourceY];
        return hypot(dx, dy);
    },
    touchAngle(event, deltaSource) {
        const sourceX = deltaSource + 'X';
        const sourceY = deltaSource + 'Y';
        const touches = pointerUtils.getTouchPair(event);
        const dx = touches[1][sourceX] - touches[0][sourceX];
        const dy = touches[1][sourceY] - touches[0][sourceY];
        const angle = 180 * Math.atan2(dy, dx) / Math.PI;
        return angle;
    },
    getPointerType(pointer) {
        return is.string(pointer.pointerType)
            ? pointer.pointerType
            : is.number(pointer.pointerType)
                ? [undefined, undefined, 'touch', 'pen', 'mouse'][pointer.pointerType]
                // if the PointerEvent API isn't available, then the "pointer" must
                // be either a MouseEvent, TouchEvent, or Touch object
                : /touch/.test(pointer.type) || pointer instanceof dom.Touch
                    ? 'touch'
                    : 'mouse';
    },
    // [ event.target, event.currentTarget ]
    getEventTargets(event) {
        const path = is.func(event.composedPath) ? event.composedPath() : event.path;
        return [
            domUtils.getActualElement(path ? path[0] : event.target),
            domUtils.getActualElement(event.currentTarget),
        ];
    },
    newCoords() {
        return {
            page: { x: 0, y: 0 },
            client: { x: 0, y: 0 },
            timeStamp: 0,
        };
    },
    coordsToEvent({ page, client, timeStamp }) {
        return {
            page,
            client,
            timeStamp,
            get pageX() { return page.x; },
            get pageY() { return page.y; },
            get clientX() { return client.x; },
            get clientY() { return client.y; },
        };
    },
};
export default pointerUtils;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9pbnRlclV0aWxzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicG9pbnRlclV0aWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sT0FBTyxNQUFNLFdBQVcsQ0FBQTtBQUMvQixPQUFPLEdBQUcsTUFBTSxjQUFjLENBQUE7QUFDOUIsT0FBTyxLQUFLLFFBQVEsTUFBTSxZQUFZLENBQUE7QUFDdEMsT0FBTyxLQUFLLE1BQU0sU0FBUyxDQUFBO0FBQzNCLE9BQU8sS0FBSyxFQUFFLE1BQU0sTUFBTSxDQUFBO0FBQzFCLE9BQU8sYUFBYSxNQUFNLGlCQUFpQixDQUFBO0FBRTNDLE1BQU0sWUFBWSxHQUFHO0lBQ25CLFVBQVUsQ0FBRSxJQUFJLEVBQUUsR0FBRztRQUNuQixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFBO1FBQzNCLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFBO1FBQ3hCLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFBO1FBRXhCLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLE1BQU0sSUFBSSxFQUFFLENBQUE7UUFDL0IsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUE7UUFDNUIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUE7UUFFNUIsSUFBSSxDQUFDLFNBQVMsR0FBRyxHQUFHLENBQUMsU0FBUyxDQUFBO0lBQ2hDLENBQUM7SUFFRCxjQUFjLENBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxHQUFHO1FBQ2xDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFNLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFNLElBQUks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QUM7Q0FDRixDQUFBO0FBRUQsZUFBZSxZQUFZLENBQUEiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgYnJvd3NlciBmcm9tICcuL2Jyb3dzZXInXG5pbXBvcnQgZG9tIGZyb20gJy4vZG9tT2JqZWN0cydcbmltcG9ydCAqIGFzIGRvbVV0aWxzIGZyb20gJy4vZG9tVXRpbHMnXG5pbXBvcnQgaHlwb3QgZnJvbSAnLi9oeXBvdCdcbmltcG9ydCAqIGFzIGlzIGZyb20gJy4vaXMnXG5pbXBvcnQgcG9pbnRlckV4dGVuZCBmcm9tICcuL3BvaW50ZXJFeHRlbmQnXG5cbmNvbnN0IHBvaW50ZXJVdGlscyA9IHtcbiAgY29weUNvb3JkcyAoZGVzdCwgc3JjKSB7XG4gICAgZGVzdC5wYWdlID0gZGVzdC5wYWdlIHx8IHt9XG4gICAgZGVzdC5wYWdlLnggPSBzcmMucGFnZS54XG4gICAgZGVzdC5wYWdlLnkgPSBzcmMucGFnZS55XG5cbiAgICBkZXN0LmNsaWVudCA9IGRlc3QuY2xpZW50IHx8IHt9XG4gICAgZGVzdC5jbGllbnQueCA9IHNyYy5jbGllbnQueFxuICAgIGRlc3QuY2xpZW50LnkgPSBzcmMuY2xpZW50LnlcblxuICAgIGRlc3QudGltZVN0YW1wID0gc3JjLnRpbWVTdGFtcFxuICB9LFxuXG4gIHNldENvb3JkRGVsdGFzICh0YXJnZXRPYmosIHByZXYsIGN1cikge1xuICAgIHRhcmdldE9iai5wYWdlLnggICAgPSBjdXIucGFnZS54ICAgIC0gcHJldi5wYWdlLnhcbiAgICB0YXJnZXRPYmoucGFnZS55ICAgID0gY3VyLnBhZ2UueSAgICAtIHByZXYucGFnZS55XG4gICAgdGFyZ2V0T2JqLmNsaWVudC54ICA9IGN1ci5jbGllbnQueCAgLSBwcmV2LmNsaWVudC54XG4gICAgdGFyZ2V0T2JqLmNsaWVudC55ICA9IGN1ci5jbGllbnQueSAgLSBwcmV2LmNsaWVudC55XG4gICAgdGFyZ2V0T2JqLnRpbWVTdGFtcCA9IGN1ci50aW1lU3RhbXAgLSBwcmV2LnRpbWVTdGFtcFxuICB9LFxuXG4gIHNldENvb3JkVmVsb2NpdHkgKHRhcmdldE9iaiwgZGVsdGEpIHtcbiAgICBjb25zdCBkdCA9IE1hdGgubWF4KGRlbHRhLnRpbWVTdGFtcCAvIDEwMDAsIDAuMDAxKVxuXG4gICAgdGFyZ2V0T2JqLnBhZ2UueCAgID0gZGVsdGEucGFnZS54IC8gZHRcbiAgICB0YXJnZXRPYmoucGFnZS55ICAgPSBkZWx0YS5wYWdlLnkgLyBkdFxuICAgIHRhcmdldE9iai5jbGllbnQueCA9IGRlbHRhLmNsaWVudC54IC8gZHRcbiAgICB0YXJnZXRPYmouY2xpZW50LnkgPSBkZWx0YS5jbGllbnQueSAvIGR0XG4gICAgdGFyZ2V0T2JqLnRpbWVTdGFtcCA9IGR0XG4gIH0sXG5cbiAgaXNOYXRpdmVQb2ludGVyICAocG9pbnRlcikge1xuICAgIHJldHVybiAocG9pbnRlciBpbnN0YW5jZW9mIGRvbS5FdmVudCB8fCBwb2ludGVyIGluc3RhbmNlb2YgZG9tLlRvdWNoKVxuICB9LFxuXG4gIC8vIEdldCBzcGVjaWZpZWQgWC9ZIGNvb3JkcyBmb3IgbW91c2Ugb3IgZXZlbnQudG91Y2hlc1swXVxuICBnZXRYWSAodHlwZSwgcG9pbnRlciwgeHkpIHtcbiAgICB4eSA9IHh5IHx8IHt9XG4gICAgdHlwZSA9IHR5cGUgfHwgJ3BhZ2UnXG5cbiAgICB4eS54ID0gcG9pbnRlclt0eXBlICsgJ1gnXVxuICAgIHh5LnkgPSBwb2ludGVyW3R5cGUgKyAnWSddXG5cbiAgICByZXR1cm4geHlcbiAgfSxcblxuICBnZXRQYWdlWFkgKHBvaW50ZXI6IEludGVyYWN0LlBvaW50ZXJUeXBlIHwgSW50ZXJhY3QuSW50ZXJhY3RFdmVudCwgcGFnZT86IEludGVyYWN0LlBvaW50KSB7XG4gICAgcGFnZSA9IHBhZ2UgfHwgeyB4OiAwLCB5OiAwIH1cblxuICAgIC8vIE9wZXJhIE1vYmlsZSBoYW5kbGVzIHRoZSB2aWV3cG9ydCBhbmQgc2Nyb2xsaW5nIG9kZGx5XG4gICAgaWYgKGJyb3dzZXIuaXNPcGVyYU1vYmlsZSAmJiBwb2ludGVyVXRpbHMuaXNOYXRpdmVQb2ludGVyKHBvaW50ZXIpKSB7XG4gICAgICBwb2ludGVyVXRpbHMuZ2V0WFkoJ3NjcmVlbicsIHBvaW50ZXIsIHBhZ2UpXG5cbiAgICAgIHBhZ2UueCArPSB3aW5kb3cuc2Nyb2xsWFxuICAgICAgcGFnZS55ICs9IHdpbmRvdy5zY3JvbGxZXG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgcG9pbnRlclV0aWxzLmdldFhZKCdwYWdlJywgcG9pbnRlciwgcGFnZSlcbiAgICB9XG5cbiAgICByZXR1cm4gcGFnZVxuICB9LFxuXG4gIGdldENsaWVudFhZIChwb2ludGVyLCBjbGllbnQpIHtcbiAgICBjbGllbnQgPSBjbGllbnQgfHwge31cblxuICAgIGlmIChicm93c2VyLmlzT3BlcmFNb2JpbGUgJiYgcG9pbnRlclV0aWxzLmlzTmF0aXZlUG9pbnRlcihwb2ludGVyKSkge1xuICAgICAgLy8gT3BlcmEgTW9iaWxlIGhhbmRsZXMgdGhlIHZpZXdwb3J0IGFuZCBzY3JvbGxpbmcgb2RkbHlcbiAgICAgIHBvaW50ZXJVdGlscy5nZXRYWSgnc2NyZWVuJywgcG9pbnRlciwgY2xpZW50KVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHBvaW50ZXJVdGlscy5nZXRYWSgnY2xpZW50JywgcG9pbnRlciwgY2xpZW50KVxuICAgIH1cblxuICAgIHJldHVybiBjbGllbnRcbiAgfSxcblxuICBnZXRQb2ludGVySWQgKHBvaW50ZXIpIHtcbiAgICByZXR1cm4gaXMubnVtYmVyKHBvaW50ZXIucG9pbnRlcklkKSA/IHBvaW50ZXIucG9pbnRlcklkIDogcG9pbnRlci5pZGVudGlmaWVyXG4gIH0sXG5cbiAgc2V0Q29vcmRzICh0YXJnZXRPYmosIHBvaW50ZXJzOiBhbnlbXSwgdGltZVN0YW1wPzogbnVtYmVyKSB7XG4gICAgY29uc3QgcG9pbnRlciA9IChwb2ludGVycy5sZW5ndGggPiAxXG4gICAgICA/IHBvaW50ZXJVdGlscy5wb2ludGVyQXZlcmFnZShwb2ludGVycylcbiAgICAgIDogcG9pbnRlcnNbMF0pXG5cbiAgICBjb25zdCB0bXBYWSA9IHt9IGFzIHsgeDogbnVtYmVyLCB5OiBudW1iZXIgfVxuXG4gICAgcG9pbnRlclV0aWxzLmdldFBhZ2VYWShwb2ludGVyLCB0bXBYWSlcbiAgICB0YXJnZXRPYmoucGFnZS54ID0gdG1wWFkueFxuICAgIHRhcmdldE9iai5wYWdlLnkgPSB0bXBYWS55XG5cbiAgICBwb2ludGVyVXRpbHMuZ2V0Q2xpZW50WFkocG9pbnRlciwgdG1wWFkpXG4gICAgdGFyZ2V0T2JqLmNsaWVudC54ID0gdG1wWFkueFxuICAgIHRhcmdldE9iai5jbGllbnQueSA9IHRtcFhZLnlcblxuICAgIHRhcmdldE9iai50aW1lU3RhbXAgPSBpcy5udW1iZXIodGltZVN0YW1wKSA/IHRpbWVTdGFtcCA6IG5ldyBEYXRlKCkuZ2V0VGltZSgpXG4gIH0sXG5cbiAgcG9pbnRlckV4dGVuZCxcblxuICBnZXRUb3VjaFBhaXIgKGV2ZW50KSB7XG4gICAgY29uc3QgdG91Y2hlcyA9IFtdXG5cbiAgICAvLyBhcnJheSBvZiB0b3VjaGVzIGlzIHN1cHBsaWVkXG4gICAgaWYgKGlzLmFycmF5KGV2ZW50KSkge1xuICAgICAgdG91Y2hlc1swXSA9IGV2ZW50WzBdXG4gICAgICB0b3VjaGVzWzFdID0gZXZlbnRbMV1cbiAgICB9XG4gICAgLy8gYW4gZXZlbnRcbiAgICBlbHNlIHtcbiAgICAgIGlmIChldmVudC50eXBlID09PSAndG91Y2hlbmQnKSB7XG4gICAgICAgIGlmIChldmVudC50b3VjaGVzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgIHRvdWNoZXNbMF0gPSBldmVudC50b3VjaGVzWzBdXG4gICAgICAgICAgdG91Y2hlc1sxXSA9IGV2ZW50LmNoYW5nZWRUb3VjaGVzWzBdXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoZXZlbnQudG91Y2hlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICB0b3VjaGVzWzBdID0gZXZlbnQuY2hhbmdlZFRvdWNoZXNbMF1cbiAgICAgICAgICB0b3VjaGVzWzFdID0gZXZlbnQuY2hhbmdlZFRvdWNoZXNbMV1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHRvdWNoZXNbMF0gPSBldmVudC50b3VjaGVzWzBdXG4gICAgICAgIHRvdWNoZXNbMV0gPSBldmVudC50b3VjaGVzWzFdXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRvdWNoZXNcbiAgfSxcblxuICBwb2ludGVyQXZlcmFnZSAocG9pbnRlcnM6IFBvaW50ZXJFdmVudFtdIHwgRXZlbnRbXSkge1xuICAgIGNvbnN0IGF2ZXJhZ2UgPSB7XG4gICAgICBwYWdlWCAgOiAwLFxuICAgICAgcGFnZVkgIDogMCxcbiAgICAgIGNsaWVudFg6IDAsXG4gICAgICBjbGllbnRZOiAwLFxuICAgICAgc2NyZWVuWDogMCxcbiAgICAgIHNjcmVlblk6IDAsXG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBwb2ludGVyIG9mIHBvaW50ZXJzKSB7XG4gICAgICBmb3IgKGNvbnN0IHByb3AgaW4gYXZlcmFnZSkge1xuICAgICAgICBhdmVyYWdlW3Byb3BdICs9IHBvaW50ZXJbcHJvcF1cbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCBwcm9wIGluIGF2ZXJhZ2UpIHtcbiAgICAgIGF2ZXJhZ2VbcHJvcF0gLz0gcG9pbnRlcnMubGVuZ3RoXG4gICAgfVxuXG4gICAgcmV0dXJuIGF2ZXJhZ2VcbiAgfSxcblxuICB0b3VjaEJCb3ggKGV2ZW50OiBFdmVudCB8IFBvaW50ZXJFdmVudFtdKSB7XG4gICAgaWYgKCEoZXZlbnQgYXMgYW55KS5sZW5ndGggJiZcbiAgICAgICAgISgoZXZlbnQgYXMgVG91Y2hFdmVudCkudG91Y2hlcyAmJlxuICAgICAgICAgIChldmVudCBhcyBUb3VjaEV2ZW50KS50b3VjaGVzLmxlbmd0aCA+IDEpKSB7XG4gICAgICByZXR1cm4gbnVsbFxuICAgIH1cblxuICAgIGNvbnN0IHRvdWNoZXMgPSBwb2ludGVyVXRpbHMuZ2V0VG91Y2hQYWlyKGV2ZW50KVxuICAgIGNvbnN0IG1pblggPSBNYXRoLm1pbih0b3VjaGVzWzBdLnBhZ2VYLCB0b3VjaGVzWzFdLnBhZ2VYKVxuICAgIGNvbnN0IG1pblkgPSBNYXRoLm1pbih0b3VjaGVzWzBdLnBhZ2VZLCB0b3VjaGVzWzFdLnBhZ2VZKVxuICAgIGNvbnN0IG1heFggPSBNYXRoLm1heCh0b3VjaGVzWzBdLnBhZ2VYLCB0b3VjaGVzWzFdLnBhZ2VYKVxuICAgIGNvbnN0IG1heFkgPSBNYXRoLm1heCh0b3VjaGVzWzBdLnBhZ2VZLCB0b3VjaGVzWzFdLnBhZ2VZKVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHg6IG1pblgsXG4gICAgICB5OiBtaW5ZLFxuICAgICAgbGVmdDogbWluWCxcbiAgICAgIHRvcDogbWluWSxcbiAgICAgIHdpZHRoOiBtYXhYIC0gbWluWCxcbiAgICAgIGhlaWdodDogbWF4WSAtIG1pblksXG4gICAgfVxuICB9LFxuXG4gIHRvdWNoRGlzdGFuY2UgKGV2ZW50LCBkZWx0YVNvdXJjZSkge1xuICAgIGNvbnN0IHNvdXJjZVggPSBkZWx0YVNvdXJjZSArICdYJ1xuICAgIGNvbnN0IHNvdXJjZVkgPSBkZWx0YVNvdXJjZSArICdZJ1xuICAgIGNvbnN0IHRvdWNoZXMgPSBwb2ludGVyVXRpbHMuZ2V0VG91Y2hQYWlyKGV2ZW50KVxuXG4gICAgY29uc3QgZHggPSB0b3VjaGVzWzBdW3NvdXJjZVhdIC0gdG91Y2hlc1sxXVtzb3VyY2VYXVxuICAgIGNvbnN0IGR5ID0gdG91Y2hlc1swXVtzb3VyY2VZXSAtIHRvdWNoZXNbMV1bc291cmNlWV1cblxuICAgIHJldHVybiBoeXBvdChkeCwgZHkpXG4gIH0sXG5cbiAgdG91Y2hBbmdsZSAoZXZlbnQsIGRlbHRhU291cmNlKSB7XG4gICAgY29uc3Qgc291cmNlWCA9IGRlbHRhU291cmNlICsgJ1gnXG4gICAgY29uc3Qgc291cmNlWSA9IGRlbHRhU291cmNlICsgJ1knXG4gICAgY29uc3QgdG91Y2hlcyA9IHBvaW50ZXJVdGlscy5nZXRUb3VjaFBhaXIoZXZlbnQpXG4gICAgY29uc3QgZHggPSB0b3VjaGVzWzFdW3NvdXJjZVhdIC0gdG91Y2hlc1swXVtzb3VyY2VYXVxuICAgIGNvbnN0IGR5ID0gdG91Y2hlc1sxXVtzb3VyY2VZXSAtIHRvdWNoZXNbMF1bc291cmNlWV1cbiAgICBjb25zdCBhbmdsZSA9IDE4MCAqIE1hdGguYXRhbjIoZHksIGR4KSAvIE1hdGguUElcblxuICAgIHJldHVybiAgYW5nbGVcbiAgfSxcblxuICBnZXRQb2ludGVyVHlwZSAocG9pbnRlcikge1xuICAgIHJldHVybiBpcy5zdHJpbmcocG9pbnRlci5wb2ludGVyVHlwZSlcbiAgICAgID8gcG9pbnRlci5wb2ludGVyVHlwZVxuICAgICAgOiBpcy5udW1iZXIocG9pbnRlci5wb2ludGVyVHlwZSlcbiAgICAgICAgPyBbdW5kZWZpbmVkLCB1bmRlZmluZWQsICd0b3VjaCcsICdwZW4nLCAnbW91c2UnXVtwb2ludGVyLnBvaW50ZXJUeXBlXVxuICAgICAgICAvLyBpZiB0aGUgUG9pbnRlckV2ZW50IEFQSSBpc24ndCBhdmFpbGFibGUsIHRoZW4gdGhlIFwicG9pbnRlclwiIG11c3RcbiAgICAgICAgLy8gYmUgZWl0aGVyIGEgTW91c2VFdmVudCwgVG91Y2hFdmVudCwgb3IgVG91Y2ggb2JqZWN0XG4gICAgICAgIDogL3RvdWNoLy50ZXN0KHBvaW50ZXIudHlwZSkgfHwgcG9pbnRlciBpbnN0YW5jZW9mIGRvbS5Ub3VjaFxuICAgICAgICAgID8gJ3RvdWNoJ1xuICAgICAgICAgIDogJ21vdXNlJ1xuICB9LFxuXG4gIC8vIFsgZXZlbnQudGFyZ2V0LCBldmVudC5jdXJyZW50VGFyZ2V0IF1cbiAgZ2V0RXZlbnRUYXJnZXRzIChldmVudCkge1xuICAgIGNvbnN0IHBhdGggPSBpcy5mdW5jKGV2ZW50LmNvbXBvc2VkUGF0aCkgPyBldmVudC5jb21wb3NlZFBhdGgoKSA6IGV2ZW50LnBhdGhcblxuICAgIHJldHVybiBbXG4gICAgICBkb21VdGlscy5nZXRBY3R1YWxFbGVtZW50KHBhdGggPyBwYXRoWzBdIDogZXZlbnQudGFyZ2V0KSxcbiAgICAgIGRvbVV0aWxzLmdldEFjdHVhbEVsZW1lbnQoZXZlbnQuY3VycmVudFRhcmdldCksXG4gICAgXVxuICB9LFxuXG4gIG5ld0Nvb3JkcyAoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHBhZ2UgICAgIDogeyB4OiAwLCB5OiAwIH0sXG4gICAgICBjbGllbnQgICA6IHsgeDogMCwgeTogMCB9LFxuICAgICAgdGltZVN0YW1wOiAwLFxuICAgIH1cbiAgfSxcblxuICBjb29yZHNUb0V2ZW50ICh7IHBhZ2UsIGNsaWVudCwgdGltZVN0YW1wIH0pIHtcbiAgICByZXR1cm4ge1xuICAgICAgcGFnZSxcbiAgICAgIGNsaWVudCxcbiAgICAgIHRpbWVTdGFtcCxcbiAgICAgIGdldCBwYWdlWCAoKSB7IHJldHVybiBwYWdlLnggfSxcbiAgICAgIGdldCBwYWdlWSAoKSB7IHJldHVybiBwYWdlLnkgfSxcbiAgICAgIGdldCBjbGllbnRYICgpIHsgcmV0dXJuIGNsaWVudC54IH0sXG4gICAgICBnZXQgY2xpZW50WSAoKSB7IHJldHVybiBjbGllbnQueSB9LFxuICAgIH1cbiAgfSxcbn1cblxuZXhwb3J0IGRlZmF1bHQgcG9pbnRlclV0aWxzXG4iXX0=