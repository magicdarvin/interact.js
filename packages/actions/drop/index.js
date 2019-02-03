import * as utils from '@interactjs/utils';
import DropEvent from './DropEvent';
function install(scope) {
    const { actions, 
    /** @lends module:interact */
    interact, 
    /** @lends Interactable */
    Interactable, interactions, defaults, } = scope;
    interactions.signals.on('after-action-start', ({ interaction, event, iEvent: dragEvent }) => {
        if (interaction.prepared.name !== 'drag') {
            return;
        }
        const { dropStatus } = interaction;
        // reset active dropzones
        dropStatus.activeDrops = null;
        dropStatus.events = null;
        if (!scope.dynamicDrop) {
            dropStatus.activeDrops = getActiveDrops(scope, interaction.element);
        }
        dropStatus.events = getDropEvents(interaction, event, dragEvent);
        if (dropStatus.events.activate) {
            fireActivationEvents(dropStatus.activeDrops, dropStatus.events.activate);
        }
    });
    interactions.signals.on('action-move', (arg) => onEventCreated(arg, scope));
    interactions.signals.on('action-end', (arg) => onEventCreated(arg, scope));
    interactions.signals.on('after-action-move', ({ interaction }) => {
        if (interaction.prepared.name !== 'drag') {
            return;
        }
        fireDropEvents(interaction, interaction.dropStatus.events);
        interaction.dropStatus.events = {};
    });
    interactions.signals.on('after-action-end', ({ interaction }) => {
        if (interaction.prepared.name === 'drag') {
            fireDropEvents(interaction, interaction.dropStatus.events);
        }
    });
    interactions.signals.on('stop', ({ interaction }) => {
        interaction.dropStatus.activeDrops = null;
        interaction.dropStatus.events = null;
    });
    interactions.signals.on('new', (interaction) => {
        interaction.dropStatus = {
            cur: {
                dropzone: null,
                element: null,
            },
            prev: {
                dropzone: null,
                element: null,
            },
            rejected: false,
            events: null,
            activeDrops: null,
        };
    });
    interactions.signals.on('stop', ({ interaction: { dropStatus } }) => {
        dropStatus.cur.dropzone = dropStatus.cur.element =
            dropStatus.prev.dropzone = dropStatus.prev.element = null;
        dropStatus.rejected = false;
    });
    /**
     *
     * ```js
     * interact('.drop').dropzone({
     *   accept: '.can-drop' || document.getElementById('single-drop'),
     *   overlap: 'pointer' || 'center' || zeroToOne
     * }
     * ```
     *
     * Returns or sets whether draggables can be dropped onto this target to
     * trigger drop events
     *
     * Dropzones can receive the following events:
     *  - `dropactivate` and `dropdeactivate` when an acceptable drag starts and ends
     *  - `dragenter` and `dragleave` when a draggable enters and leaves the dropzone
     *  - `dragmove` when a draggable that has entered the dropzone is moved
     *  - `drop` when a draggable is dropped into this dropzone
     *
     * Use the `accept` option to allow only elements that match the given CSS
     * selector or element. The value can be:
     *
     *  - **an Element** - only that element can be dropped into this dropzone.
     *  - **a string**, - the element being dragged must match it as a CSS selector.
     *  - **`null`** - accept options is cleared - it accepts any element.
     *
     * Use the `overlap` option to set how drops are checked for. The allowed
     * values are:
     *
     *   - `'pointer'`, the pointer must be over the dropzone (default)
     *   - `'center'`, the draggable element's center must be over the dropzone
     *   - a number from 0-1 which is the `(intersection area) / (draggable area)`.
     *   e.g. `0.5` for drop to happen when half of the area of the draggable is
     *   over the dropzone
     *
     * Use the `checker` option to specify a function to check if a dragged element
     * is over this Interactable.
     *
     * @param {boolean | object | null} [options] The new options to be set.
     * @return {boolean | Interactable} The current setting or this Interactable
     */
    Interactable.prototype.dropzone = function (options) {
        return dropzoneMethod(this, options);
    };
    /**
     * ```js
     * interact(target)
     * .dropChecker(function(dragEvent,         // related dragmove or dragend event
     *                       event,             // TouchEvent/PointerEvent/MouseEvent
     *                       dropped,           // bool result of the default checker
     *                       dropzone,          // dropzone Interactable
     *                       dropElement,       // dropzone elemnt
     *                       draggable,         // draggable Interactable
     *                       draggableElement) {// draggable element
     *
     *   return dropped && event.target.hasAttribute('allow-drop');
     * }
     * ```
     */
    Interactable.prototype.dropCheck = function (dragEvent, event, draggable, draggableElement, dropElement, rect) {
        return dropCheckMethod(this, dragEvent, event, draggable, draggableElement, dropElement, rect);
    };
    /**
     * Returns or sets whether the dimensions of dropzone elements are calculated
     * on every dragmove or only on dragstart for the default dropChecker
     *
     * @param {boolean} [newValue] True to check on each move. False to check only
     * before start
     * @return {boolean | interact} The current setting or interact
     */
    interact.dynamicDrop = function (newValue) {
        if (utils.is.bool(newValue)) {
            // if (dragging && scope.dynamicDrop !== newValue && !newValue) {
            //  calcRects(dropzones);
            // }
            scope.dynamicDrop = newValue;
            return interact;
        }
        return scope.dynamicDrop;
    };
    utils.arr.merge(actions.eventTypes, [
        'dragenter',
        'dragleave',
        'dropactivate',
        'dropdeactivate',
        'dropmove',
        'drop',
    ]);
    actions.methodDict.drop = 'dropzone';
    scope.dynamicDrop = false;
    defaults.actions.drop = drop.defaults;
}
function collectDrops({ interactables }, draggableElement) {
    const drops = [];
    // collect all dropzones and their elements which qualify for a drop
    for (const dropzone of interactables.list) {
        if (!dropzone.options.drop.enabled) {
            continue;
        }
        const accept = dropzone.options.drop.accept;
        // test the draggable draggableElement against the dropzone's accept setting
        if ((utils.is.element(accept) && accept !== draggableElement) ||
            (utils.is.string(accept) &&
                !utils.dom.matchesSelector(draggableElement, accept)) ||
            (utils.is.func(accept) && !accept({ dropzone, draggableElement }))) {
            continue;
        }
        // query for new elements if necessary
        const dropElements = utils.is.string(dropzone.target)
            ? dropzone._context.querySelectorAll(dropzone.target)
            : utils.is.array(dropzone.target) ? dropzone.target : [dropzone.target];
        for (const dropzoneElement of dropElements) {
            if (dropzoneElement !== draggableElement) {
                drops.push({
                    dropzone,
                    element: dropzoneElement,
                });
            }
        }
    }
    return drops;
}
function fireActivationEvents(activeDrops, event) {
    // loop through all active dropzones and trigger event
    for (const { dropzone, element } of activeDrops) {
        event.dropzone = dropzone;
        // set current element as event target
        event.target = element;
        dropzone.fire(event);
        event.propagationStopped = event.immediatePropagationStopped = false;
    }
}
// return a new array of possible drops. getActiveDrops should always be
// called when a drag has just started or a drag event happens while
// dynamicDrop is true
function getActiveDrops(scope, dragElement) {
    // get dropzones and their elements that could receive the draggable
    const activeDrops = collectDrops(scope, dragElement);
    for (const activeDrop of activeDrops) {
        activeDrop.rect = activeDrop.dropzone.getRect(activeDrop.element);
    }
    return activeDrops;
}
function getDrop({ dropStatus, target: draggable, element: dragElement }, dragEvent, pointerEvent) {
    const validDrops = [];
    // collect all dropzones and their elements which qualify for a drop
    for (const { dropzone, element: dropzoneElement, rect } of dropStatus.activeDrops) {
        validDrops.push(dropzone.dropCheck(dragEvent, pointerEvent, draggable, dragElement, dropzoneElement, rect)
            ? dropzoneElement
            : null);
    }
    // get the most appropriate dropzone based on DOM depth and order
    const dropIndex = utils.dom.indexOfDeepestElement(validDrops);
    return dropStatus.activeDrops[dropIndex] || null;
}
function getDropEvents(interaction, _pointerEvent, dragEvent) {
    const { dropStatus } = interaction;
    const dropEvents = {
        enter: null,
        leave: null,
        activate: null,
        deactivate: null,
        move: null,
        drop: null,
    };
    if (dragEvent.type === 'dragstart') {
        dropEvents.activate = new DropEvent(dropStatus, dragEvent, 'dropactivate');
        dropEvents.activate.target = null;
        dropEvents.activate.dropzone = null;
    }
    if (dragEvent.type === 'dragend') {
        dropEvents.deactivate = new DropEvent(dropStatus, dragEvent, 'dropdeactivate');
        dropEvents.deactivate.target = null;
        dropEvents.deactivate.dropzone = null;
    }
    if (dropStatus.rejected) {
        return dropEvents;
    }
    if (dropStatus.cur.element !== dropStatus.prev.element) {
        // if there was a previous dropzone, create a dragleave event
        if (dropStatus.prev.dropzone) {
            dropEvents.leave = new DropEvent(dropStatus, dragEvent, 'dragleave');
            dragEvent.dragLeave = dropEvents.leave.target = dropStatus.prev.element;
            dragEvent.prevDropzone = dropEvents.leave.dropzone = dropStatus.prev.dropzone;
        }
        // if dropzone is not null, create a dragenter event
        if (dropStatus.cur.dropzone) {
            dropEvents.enter = new DropEvent(dropStatus, dragEvent, 'dragenter');
            dragEvent.dragEnter = dropStatus.cur.element;
            dragEvent.dropzone = dropStatus.cur.dropzone;
        }
    }
    if (dragEvent.type === 'dragend' && dropStatus.cur.dropzone) {
        dropEvents.drop = new DropEvent(dropStatus, dragEvent, 'drop');
        dragEvent.dropzone = dropStatus.cur.dropzone;
        dragEvent.relatedTarget = dropStatus.cur.element;
    }
    if (dragEvent.type === 'dragmove' && dropStatus.cur.dropzone) {
        dropEvents.move = new DropEvent(dropStatus, dragEvent, 'dropmove');
        dropEvents.move.dragmove = dragEvent;
        dragEvent.dropzone = dropStatus.cur.dropzone;
    }
    return dropEvents;
}
function fireDropEvents(interaction, events) {
    const { dropStatus } = interaction;
    const { activeDrops, cur, prev, } = dropStatus;
    if (events.leave) {
        prev.dropzone.fire(events.leave);
    }
    if (events.move) {
        cur.dropzone.fire(events.move);
    }
    if (events.enter) {
        cur.dropzone.fire(events.enter);
    }
    if (events.drop) {
        cur.dropzone.fire(events.drop);
    }
    if (events.deactivate) {
        fireActivationEvents(activeDrops, events.deactivate);
    }
    dropStatus.prev.dropzone = cur.dropzone;
    dropStatus.prev.element = cur.element;
}
function onEventCreated({ interaction, iEvent, event }, scope) {
    if (iEvent.type !== 'dragmove' && iEvent.type !== 'dragend') {
        return;
    }
    const { dropStatus } = interaction;
    if (scope.dynamicDrop) {
        dropStatus.activeDrops = getActiveDrops(scope, interaction.element);
    }
    const dragEvent = iEvent;
    const dropResult = getDrop(interaction, dragEvent, event);
    // update rejected status
    dropStatus.rejected = dropStatus.rejected &&
        !!dropResult &&
        dropResult.dropzone === dropStatus.cur.dropzone &&
        dropResult.element === dropStatus.cur.element;
    dropStatus.cur.dropzone = dropResult && dropResult.dropzone;
    dropStatus.cur.element = dropResult && dropResult.element;
    dropStatus.events = getDropEvents(interaction, event, dragEvent);
}
function dropzoneMethod(interactable, options) {
    if (utils.is.object(options)) {
        interactable.options.drop.enabled = options.enabled !== false;
        if (options.listeners) {
            const normalized = utils.normalizeListeners(options.listeners);
            // rename 'drop' to '' as it will be prefixed with 'drop'
            const corrected = Object.keys(normalized).reduce((acc, type) => {
                const correctedType = /^(enter|leave)/.test(type)
                    ? `drag${type}`
                    : /^(activate|deactivate|move)/.test(type)
                        ? `drop${type}`
                        : type;
                acc[correctedType] = normalized[type];
                return acc;
            }, {});
            interactable.off(interactable.options.drop.listeners);
            interactable.on(corrected);
            interactable.options.drop.listeners = corrected;
        }
        if (utils.is.func(options.ondrop)) {
            interactable.on('drop', options.ondrop);
        }
        if (utils.is.func(options.ondropactivate)) {
            interactable.on('dropactivate', options.ondropactivate);
        }
        if (utils.is.func(options.ondropdeactivate)) {
            interactable.on('dropdeactivate', options.ondropdeactivate);
        }
        if (utils.is.func(options.ondragenter)) {
            interactable.on('dragenter', options.ondragenter);
        }
        if (utils.is.func(options.ondragleave)) {
            interactable.on('dragleave', options.ondragleave);
        }
        if (utils.is.func(options.ondropmove)) {
            interactable.on('dropmove', options.ondropmove);
        }
        if (/^(pointer|center)$/.test(options.overlap)) {
            interactable.options.drop.overlap = options.overlap;
        }
        else if (utils.is.number(options.overlap)) {
            interactable.options.drop.overlap = Math.max(Math.min(1, options.overlap), 0);
        }
        if ('accept' in options) {
            interactable.options.drop.accept = options.accept;
        }
        if ('checker' in options) {
            interactable.options.drop.checker = options.checker;
        }
        return interactable;
    }
    if (utils.is.bool(options)) {
        interactable.options.drop.enabled = options;
        return interactable;
    }
    return interactable.options.drop;
}
function dropCheckMethod(interactable, dragEvent, event, draggable, draggableElement, dropElement, rect) {
    let dropped = false;
    // if the dropzone has no rect (eg. display: none)
    // call the custom dropChecker or just return false
    if (!(rect = rect || interactable.getRect(dropElement))) {
        return (interactable.options.drop.checker
            ? interactable.options.drop.checker(dragEvent, event, dropped, interactable, dropElement, draggable, draggableElement)
            : false);
    }
    const dropOverlap = interactable.options.drop.overlap;
    if (dropOverlap === 'pointer') {
        const origin = utils.getOriginXY(draggable, draggableElement, 'drag');
        const page = utils.pointer.getPageXY(dragEvent);
        page.x += origin.x;
        page.y += origin.y;
        const horizontal = (page.x > rect.left) && (page.x < rect.right);
        const vertical = (page.y > rect.top) && (page.y < rect.bottom);
        dropped = horizontal && vertical;
    }
    const dragRect = draggable.getRect(draggableElement);
    if (dragRect && dropOverlap === 'center') {
        const cx = dragRect.left + dragRect.width / 2;
        const cy = dragRect.top + dragRect.height / 2;
        dropped = cx >= rect.left && cx <= rect.right && cy >= rect.top && cy <= rect.bottom;
    }
    if (dragRect && utils.is.number(dropOverlap)) {
        const overlapArea = (Math.max(0, Math.min(rect.right, dragRect.right) - Math.max(rect.left, dragRect.left)) *
            Math.max(0, Math.min(rect.bottom, dragRect.bottom) - Math.max(rect.top, dragRect.top)));
        const overlapRatio = overlapArea / (dragRect.width * dragRect.height);
        dropped = overlapRatio >= dropOverlap;
    }
    if (interactable.options.drop.checker) {
        dropped = interactable.options.drop.checker(dragEvent, event, dropped, interactable, dropElement, draggable, draggableElement);
    }
    return dropped;
}
const drop = {
    install,
    getActiveDrops,
    getDrop,
    getDropEvents,
    fireDropEvents,
    defaults: {
        enabled: false,
        accept: null,
        overlap: 'pointer',
    },
};
export default drop;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFFQSxPQUFPLEtBQUssS0FBSyxNQUFNLG1CQUFtQixDQUFBO0FBQzFDLE9BQU8sU0FBUyxNQUFNLGFBQWEsQ0FBQTtBQTBDbkMsU0FBUyxPQUFPLENBQUUsS0FBWTtJQUM1QixNQUFNLEVBQ0osT0FBTztJQUNQLDZCQUE2QjtJQUM3QixRQUFRO0lBQ1IsMEJBQTBCO0lBQzFCLFlBQVksRUFDWixZQUFZLEVBQ1osUUFBUSxHQUNULEdBQUcsS0FBSyxDQUFBO0lBRVQsWUFBWSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsb0JBQW9CLEVBQUUsQ0FBQyxFQUFFLFdBQVcsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxFQUFFLEVBQUU7UUFDMUYsSUFBSSxXQUFXLENBQUMsUUFBUSxDQUFDLElBQUksS0FBSyxNQUFNLEVBQUU7WUFBRSxPQUFNO1NBQUU7UUFFcEQsTUFBTSxFQUFFLFVBQVUsRUFBRSxHQUFHLFdBQVcsQ0FBQTtRQUVsQyx5QkFBeUI7UUFDekIsVUFBVSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUE7UUFDN0IsVUFBVSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUE7UUFFeEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxXQUFXLEVBQUU7WUFDdEIsVUFBVSxDQUFDLFdBQVcsR0FBRyxjQUFjLENBQUMsS0FBSyxFQUFFLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQTtTQUNwRTtRQUVELFVBQVUsQ0FBQyxNQUFNLEdBQUcsYUFBYSxDQUFDLFdBQVcsRUFBRSxLQUFLLEVBQUUsU0FBUyxDQUFDLENBQUE7UUFFaEUsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRTtZQUM5QixvQkFBb0IsQ0FBQyxVQUFVLENBQUMsV0FBVyxFQUFFLFVBQVUsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUE7U0FDekU7SUFDSCxDQUFDLENBQUMsQ0FBQTtJQUVGLFlBQVksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLGFBQWEsRUFBRSxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsY0FBYyxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFBO0lBQzNFLFlBQVksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLFlBQVksRUFBRSxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsY0FBYyxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFBO0lBRTFFLFlBQVksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLG1CQUFtQixFQUFFLENBQUMsRUFBRSxXQUFXLEVBQUUsRUFBRSxFQUFFO1FBQy9ELElBQUksV0FBVyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEtBQUssTUFBTSxFQUFFO1lBQUUsT0FBTTtTQUFFO1FBRXBELGNBQWMsQ0FBQyxXQUFXLEVBQUUsV0FBVyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQTtRQUMxRCxXQUFXLENBQUMsVUFBVSxDQUFDLE1BQU0sR0FBRyxFQUFFLENBQUE7SUFDcEMsQ0FBQyxDQUFDLENBQUE7SUFFRixZQUFZLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxrQkFBa0IsRUFBRSxDQUFDLEVBQUUsV0FBVyxFQUFFLEVBQUUsRUFBRTtRQUM5RCxJQUFJLFdBQVcsQ0FBQyxRQUFRLENBQUMsSUFBSSxLQUFLLE1BQU0sRUFBRTtZQUN4QyxjQUFjLENBQUMsV0FBVyxFQUFFLFdBQVcsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUE7U0FDM0Q7SUFDSCxDQUFDLENBQUMsQ0FBQTtJQUVGLFlBQVksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsV0FBVyxFQUFFLEVBQUUsRUFBRTtRQUNsRCxXQUFXLENBQUMsVUFBVSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUE7UUFDekMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFBO0lBQ3RDLENBQUMsQ0FBQyxDQUFBO0lBRUYsWUFBWSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsS0FBSyxFQUFFLENBQUMsV0FBVyxFQUFFLEVBQUU7UUFDN0MsV0FBVyxDQUFDLFVBQVUsR0FBRztZQUN2QixHQUFHLEVBQUU7Z0JBQ0gsUUFBUSxFQUFHLElBQUk7Z0JBQ2YsT0FBTyxFQUFJLElBQUk7YUFDaEI7WUFDRCxJQUFJLEVBQUU7Z0JBQ0osUUFBUSxFQUFHLElBQUk7Z0JBQ2YsT0FBTyxFQUFJLElBQUk7YUFDaEI7WUFDRCxRQUFRLEVBQUssS0FBSztZQUNsQixNQUFNLEVBQU8sSUFBSTtZQUNqQixXQUFXLEVBQUUsSUFBSTtTQUNsQixDQUFBO0lBQ0gsQ0FBQyxDQUFDLENBQUE7SUFFRixZQUFZLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLFdBQVcsRUFBRSxFQUFFLFVBQVUsRUFBRSxFQUFFLEVBQUUsRUFBRTtRQUNsRSxVQUFVLENBQUMsR0FBRyxDQUFDLFFBQVEsR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLE9BQU87WUFDOUMsVUFBVSxDQUFDLElBQUksQ0FBQyxRQUFRLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFBO1FBQzNELFVBQVUsQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFBO0lBQzdCLENBQUMsQ0FBQyxDQUFBO0lBRUY7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztPQXVDRztJQUNILFlBQVksQ0FBQyxTQUFTLENBQUMsUUFBUSxHQUFHLFVBQXVDLE9BQU87UUFDOUUsT0FBTyxjQUFjLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFBO0lBQ3RDLENBQUMsQ0FBQTtJQUVEOzs7Ozs7Ozs7Ozs7OztPQWNHO0lBQ0gsWUFBWSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEdBQUcsVUFBdUMsU0FBUyxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsZ0JBQWdCLEVBQUUsV0FBVyxFQUFFLElBQUk7UUFDeEksT0FBTyxlQUFlLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLGdCQUFnQixFQUFFLFdBQVcsRUFBRSxJQUFJLENBQUMsQ0FBQTtJQUNoRyxDQUFDLENBQUE7SUFFRDs7Ozs7OztPQU9HO0lBQ0gsUUFBUSxDQUFDLFdBQVcsR0FBRyxVQUFVLFFBQWtCO1FBQ2pELElBQUksS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUU7WUFDM0IsaUVBQWlFO1lBQ2pFLHlCQUF5QjtZQUN6QixJQUFJO1lBRUosS0FBSyxDQUFDLFdBQVcsR0FBRyxRQUFRLENBQUE7WUFFNUIsT0FBTyxRQUFRLENBQUE7U0FDaEI7UUFDRCxPQUFPLEtBQUssQ0FBQyxXQUFXLENBQUE7SUFDMUIsQ0FBQyxDQUFBO0lBRUQsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRTtRQUNsQyxXQUFXO1FBQ1gsV0FBVztRQUNYLGNBQWM7UUFDZCxnQkFBZ0I7UUFDaEIsVUFBVTtRQUNWLE1BQU07S0FDUCxDQUFDLENBQUE7SUFDRixPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksR0FBRyxVQUFVLENBQUE7SUFFcEMsS0FBSyxDQUFDLFdBQVcsR0FBRyxLQUFLLENBQUE7SUFFekIsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQTtBQUN2QyxDQUFDO0FBRUQsU0FBUyxZQUFZLENBQUUsRUFBRSxhQUFhLEVBQUUsRUFBRSxnQkFBZ0I7SUFDeEQsTUFBTSxLQUFLLEdBQUcsRUFBRSxDQUFBO0lBRWhCLG9FQUFvRTtJQUNwRSxLQUFLLE1BQU0sUUFBUSxJQUFJLGFBQWEsQ0FBQyxJQUFJLEVBQUU7UUFDekMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRTtZQUFFLFNBQVE7U0FBRTtRQUVoRCxNQUFNLE1BQU0sR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUE7UUFFM0MsNEVBQTRFO1FBQzVFLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxNQUFNLEtBQUssZ0JBQWdCLENBQUM7WUFDekQsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7Z0JBQ3hCLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsZ0JBQWdCLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFDckQsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLFFBQVEsRUFBRSxnQkFBZ0IsRUFBRSxDQUFDLENBQUMsRUFBRTtZQUN0RSxTQUFRO1NBQ1Q7UUFFRCxzQ0FBc0M7UUFDdEMsTUFBTSxZQUFZLEdBQUcsS0FBSyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQztZQUNuRCxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDO1lBQ3JELENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFBO1FBRXpFLEtBQUssTUFBTSxlQUFlLElBQUksWUFBWSxFQUFFO1lBQzFDLElBQUksZUFBZSxLQUFLLGdCQUFnQixFQUFFO2dCQUN4QyxLQUFLLENBQUMsSUFBSSxDQUFDO29CQUNULFFBQVE7b0JBQ1IsT0FBTyxFQUFFLGVBQWU7aUJBQ3pCLENBQUMsQ0FBQTthQUNIO1NBQ0Y7S0FDRjtJQUVELE9BQU8sS0FBSyxDQUFBO0FBQ2QsQ0FBQztBQUVELFNBQVMsb0JBQW9CLENBQUUsV0FBVyxFQUFFLEtBQUs7SUFDL0Msc0RBQXNEO0lBQ3RELEtBQUssTUFBTSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsSUFBSSxXQUFXLEVBQUU7UUFDL0MsS0FBSyxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUE7UUFFekIsc0NBQXNDO1FBQ3RDLEtBQUssQ0FBQyxNQUFNLEdBQUcsT0FBTyxDQUFBO1FBQ3RCLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUE7UUFDcEIsS0FBSyxDQUFDLGtCQUFrQixHQUFHLEtBQUssQ0FBQywyQkFBMkIsR0FBRyxLQUFLLENBQUE7S0FDckU7QUFDSCxDQUFDO0FBRUQsd0VBQXdFO0FBQ3hFLG9FQUFvRTtBQUNwRSxzQkFBc0I7QUFDdEIsU0FBUyxjQUFjLENBQUUsS0FBWSxFQUFFLFdBQW9CO0lBQ3pELG9FQUFvRTtJQUNwRSxNQUFNLFdBQVcsR0FBRyxZQUFZLENBQUMsS0FBSyxFQUFFLFdBQVcsQ0FBQyxDQUFBO0lBRXBELEtBQUssTUFBTSxVQUFVLElBQUksV0FBVyxFQUFFO1FBQ3BDLFVBQVUsQ0FBQyxJQUFJLEdBQUcsVUFBVSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFBO0tBQ2xFO0lBRUQsT0FBTyxXQUFXLENBQUE7QUFDcEIsQ0FBQztBQUVELFNBQVMsT0FBTyxDQUFFLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxFQUFFLFNBQVMsRUFBRSxZQUFZO0lBQ2hHLE1BQU0sVUFBVSxHQUFHLEVBQUUsQ0FBQTtJQUVyQixvRUFBb0U7SUFDcEUsS0FBSyxNQUFNLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxlQUFlLEVBQUUsSUFBSSxFQUFFLElBQUksVUFBVSxDQUFDLFdBQVcsRUFBRTtRQUNqRixVQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsU0FBUyxFQUFFLFlBQVksRUFBRSxTQUFTLEVBQUUsV0FBVyxFQUFFLGVBQWUsRUFBRSxJQUFJLENBQUM7WUFDeEcsQ0FBQyxDQUFDLGVBQWU7WUFDakIsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFBO0tBQ1Y7SUFFRCxpRUFBaUU7SUFDakUsTUFBTSxTQUFTLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxVQUFVLENBQUMsQ0FBQTtJQUU3RCxPQUFPLFVBQVUsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLElBQUksSUFBSSxDQUFBO0FBQ2xELENBQUM7QUFFRCxTQUFTLGFBQWEsQ0FBRSxXQUFXLEVBQUUsYUFBYSxFQUFFLFNBQVM7SUFDM0QsTUFBTSxFQUFFLFVBQVUsRUFBRSxHQUFHLFdBQVcsQ0FBQTtJQUNsQyxNQUFNLFVBQVUsR0FBRztRQUNqQixLQUFLLEVBQU8sSUFBSTtRQUNoQixLQUFLLEVBQU8sSUFBSTtRQUNoQixRQUFRLEVBQUksSUFBSTtRQUNoQixVQUFVLEVBQUUsSUFBSTtRQUNoQixJQUFJLEVBQVEsSUFBSTtRQUNoQixJQUFJLEVBQVEsSUFBSTtLQUNqQixDQUFBO0lBRUQsSUFBSSxTQUFTLENBQUMsSUFBSSxLQUFLLFdBQVcsRUFBRTtRQUNsQyxVQUFVLENBQUMsUUFBUSxHQUFHLElBQUksU0FBUyxDQUFDLFVBQVUsRUFBRSxTQUFTLEVBQUUsY0FBYyxDQUFDLENBQUE7UUFFMUUsVUFBVSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEdBQUssSUFBSSxDQUFBO1FBQ25DLFVBQVUsQ0FBQyxRQUFRLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQTtLQUNwQztJQUNELElBQUksU0FBUyxDQUFDLElBQUksS0FBSyxTQUFTLEVBQUU7UUFDaEMsVUFBVSxDQUFDLFVBQVUsR0FBRyxJQUFJLFNBQVMsQ0FBQyxVQUFVLEVBQUUsU0FBUyxFQUFFLGdCQUFnQixDQUFDLENBQUE7UUFFOUUsVUFBVSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEdBQUssSUFBSSxDQUFBO1FBQ3JDLFVBQVUsQ0FBQyxVQUFVLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQTtLQUN0QztJQUVELElBQUksVUFBVSxDQUFDLFFBQVEsRUFBRTtRQUN2QixPQUFPLFVBQVUsQ0FBQTtLQUNsQjtJQUVELElBQUksVUFBVSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEtBQUssVUFBVSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUU7UUFDdEQsNkRBQTZEO1FBQzdELElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUU7WUFDNUIsVUFBVSxDQUFDLEtBQUssR0FBRyxJQUFJLFNBQVMsQ0FBQyxVQUFVLEVBQUUsU0FBUyxFQUFFLFdBQVcsQ0FBQyxDQUFBO1lBRXBFLFNBQVMsQ0FBQyxTQUFTLEdBQU0sVUFBVSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUssVUFBVSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUE7WUFDNUUsU0FBUyxDQUFDLFlBQVksR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDLFFBQVEsR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQTtTQUM5RTtRQUNELG9EQUFvRDtRQUNwRCxJQUFJLFVBQVUsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFO1lBQzNCLFVBQVUsQ0FBQyxLQUFLLEdBQUcsSUFBSSxTQUFTLENBQUMsVUFBVSxFQUFFLFNBQVMsRUFBRSxXQUFXLENBQUMsQ0FBQTtZQUVwRSxTQUFTLENBQUMsU0FBUyxHQUFHLFVBQVUsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFBO1lBQzVDLFNBQVMsQ0FBQyxRQUFRLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUE7U0FDN0M7S0FDRjtJQUVELElBQUksU0FBUyxDQUFDLElBQUksS0FBSyxTQUFTLElBQUksVUFBVSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUU7UUFDM0QsVUFBVSxDQUFDLElBQUksR0FBRyxJQUFJLFNBQVMsQ0FBQyxVQUFVLEVBQUUsU0FBUyxFQUFFLE1BQU0sQ0FBQyxDQUFBO1FBRTlELFNBQVMsQ0FBQyxRQUFRLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUE7UUFDNUMsU0FBUyxDQUFDLGFBQWEsR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQTtLQUNqRDtJQUNELElBQUksU0FBUyxDQUFDLElBQUksS0FBSyxVQUFVLElBQUksVUFBVSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUU7UUFDNUQsVUFBVSxDQUFDLElBQUksR0FBRyxJQUFJLFNBQVMsQ0FBQyxVQUFVLEVBQUUsU0FBUyxFQUFFLFVBQVUsQ0FBQyxDQUFBO1FBRWxFLFVBQVUsQ0FBQyxJQUFJLENBQUMsUUFBUSxHQUFHLFNBQVMsQ0FBQTtRQUNwQyxTQUFTLENBQUMsUUFBUSxHQUFHLFVBQVUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFBO0tBQzdDO0lBRUQsT0FBTyxVQUFVLENBQUE7QUFDbkIsQ0FBQztBQUVELFNBQVMsY0FBYyxDQUFFLFdBQVcsRUFBRSxNQUFNO0lBQzFDLE1BQU0sRUFBRSxVQUFVLEVBQUUsR0FBRyxXQUFXLENBQUE7SUFDbEMsTUFBTSxFQUNKLFdBQVcsRUFDWCxHQUFHLEVBQ0gsSUFBSSxHQUNMLEdBQUcsVUFBVSxDQUFBO0lBRWQsSUFBSSxNQUFNLENBQUMsS0FBSyxFQUFFO1FBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFBO0tBQUU7SUFDdEQsSUFBSSxNQUFNLENBQUMsSUFBSSxFQUFFO1FBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFBO0tBQUU7SUFDbkQsSUFBSSxNQUFNLENBQUMsS0FBSyxFQUFFO1FBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFBO0tBQUU7SUFDckQsSUFBSSxNQUFNLENBQUMsSUFBSSxFQUFFO1FBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFBO0tBQUU7SUFFbkQsSUFBSSxNQUFNLENBQUMsVUFBVSxFQUFFO1FBQ3JCLG9CQUFvQixDQUFDLFdBQVcsRUFBRSxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUE7S0FDckQ7SUFFRCxVQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsR0FBSSxHQUFHLENBQUMsUUFBUSxDQUFBO0lBQ3hDLFVBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTyxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUE7QUFDdkMsQ0FBQztBQUVELFNBQVMsY0FBYyxDQUFFLEVBQUUsV0FBVyxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsRUFBRSxLQUFLO0lBQzVELElBQUksTUFBTSxDQUFDLElBQUksS0FBSyxVQUFVLElBQUksTUFBTSxDQUFDLElBQUksS0FBSyxTQUFTLEVBQUU7UUFBRSxPQUFNO0tBQUU7SUFFdkUsTUFBTSxFQUFFLFVBQVUsRUFBRSxHQUFHLFdBQVcsQ0FBQTtJQUVsQyxJQUFJLEtBQUssQ0FBQyxXQUFXLEVBQUU7UUFDckIsVUFBVSxDQUFDLFdBQVcsR0FBRyxjQUFjLENBQUMsS0FBSyxFQUFFLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQTtLQUNwRTtJQUVELE1BQU0sU0FBUyxHQUFHLE1BQU0sQ0FBQTtJQUN4QixNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsV0FBVyxFQUFFLFNBQVMsRUFBRSxLQUFLLENBQUMsQ0FBQTtJQUV6RCx5QkFBeUI7SUFDekIsVUFBVSxDQUFDLFFBQVEsR0FBRyxVQUFVLENBQUMsUUFBUTtRQUN2QyxDQUFDLENBQUMsVUFBVTtRQUNaLFVBQVUsQ0FBQyxRQUFRLEtBQUssVUFBVSxDQUFDLEdBQUcsQ0FBQyxRQUFRO1FBQy9DLFVBQVUsQ0FBQyxPQUFPLEtBQUssVUFBVSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUE7SUFFL0MsVUFBVSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEdBQUksVUFBVSxJQUFJLFVBQVUsQ0FBQyxRQUFRLENBQUE7SUFDNUQsVUFBVSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEdBQUcsVUFBVSxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUE7SUFFekQsVUFBVSxDQUFDLE1BQU0sR0FBRyxhQUFhLENBQUMsV0FBVyxFQUFFLEtBQUssRUFBRSxTQUFTLENBQUMsQ0FBQTtBQUNsRSxDQUFDO0FBRUQsU0FBUyxjQUFjLENBQUUsWUFBbUMsRUFBRSxPQUEyQztJQUN2RyxJQUFJLEtBQUssQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxFQUFFO1FBQzVCLFlBQVksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUMsT0FBTyxLQUFLLEtBQUssQ0FBQTtRQUU3RCxJQUFJLE9BQU8sQ0FBQyxTQUFTLEVBQUU7WUFDckIsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQTtZQUM5RCx5REFBeUQ7WUFDekQsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLEVBQUU7Z0JBQzdELE1BQU0sYUFBYSxHQUFHLGdCQUFnQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7b0JBQy9DLENBQUMsQ0FBQyxPQUFPLElBQUksRUFBRTtvQkFDZixDQUFDLENBQUMsNkJBQTZCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQzt3QkFDeEMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxFQUFFO3dCQUNmLENBQUMsQ0FBQyxJQUFJLENBQUE7Z0JBRVYsR0FBRyxDQUFDLGFBQWEsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQTtnQkFFckMsT0FBTyxHQUFHLENBQUE7WUFDWixDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUE7WUFFTixZQUFZLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFBO1lBQ3JELFlBQVksQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUE7WUFDMUIsWUFBWSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQTtTQUNoRDtRQUVELElBQUksS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQUUsWUFBWSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFBO1NBQUU7UUFDOUUsSUFBSSxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLEVBQUU7WUFBRSxZQUFZLENBQUMsRUFBRSxDQUFDLGNBQWMsRUFBRSxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUE7U0FBRTtRQUN0RyxJQUFJLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFO1lBQUUsWUFBWSxDQUFDLEVBQUUsQ0FBQyxnQkFBZ0IsRUFBRSxPQUFPLENBQUMsZ0JBQWdCLENBQUMsQ0FBQTtTQUFFO1FBQzVHLElBQUksS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxFQUFFO1lBQUUsWUFBWSxDQUFDLEVBQUUsQ0FBQyxXQUFXLEVBQUUsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFBO1NBQUU7UUFDN0YsSUFBSSxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLEVBQUU7WUFBRSxZQUFZLENBQUMsRUFBRSxDQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUE7U0FBRTtRQUM3RixJQUFJLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsRUFBRTtZQUFFLFlBQVksQ0FBQyxFQUFFLENBQUMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQTtTQUFFO1FBRTFGLElBQUksb0JBQW9CLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFpQixDQUFDLEVBQUU7WUFDeEQsWUFBWSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUE7U0FDcEQ7YUFDSSxJQUFJLEtBQUssQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRTtZQUN6QyxZQUFZLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7U0FDOUU7UUFDRCxJQUFJLFFBQVEsSUFBSSxPQUFPLEVBQUU7WUFDdkIsWUFBWSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUE7U0FDbEQ7UUFDRCxJQUFJLFNBQVMsSUFBSSxPQUFPLEVBQUU7WUFDeEIsWUFBWSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUE7U0FDcEQ7UUFFRCxPQUFPLFlBQVksQ0FBQTtLQUNwQjtJQUVELElBQUksS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUU7UUFDMUIsWUFBWSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQTtRQUUzQyxPQUFPLFlBQVksQ0FBQTtLQUNwQjtJQUVELE9BQU8sWUFBWSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUE7QUFDbEMsQ0FBQztBQUVELFNBQVMsZUFBZSxDQUN0QixZQUFtQyxFQUNuQyxTQUF3QixFQUN4QixLQUFnQyxFQUNoQyxTQUFnQyxFQUNoQyxnQkFBeUIsRUFDekIsV0FBb0IsRUFDcEIsSUFBUztJQUVULElBQUksT0FBTyxHQUFHLEtBQUssQ0FBQTtJQUVuQixrREFBa0Q7SUFDbEQsbURBQW1EO0lBQ25ELElBQUksQ0FBQyxDQUFDLElBQUksR0FBRyxJQUFJLElBQUksWUFBWSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQyxFQUFFO1FBQ3ZELE9BQU8sQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPO1lBQ3ZDLENBQUMsQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsWUFBWSxFQUFFLFdBQVcsRUFBRSxTQUFTLEVBQUUsZ0JBQWdCLENBQUM7WUFDdEgsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFBO0tBQ1g7SUFFRCxNQUFNLFdBQVcsR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUE7SUFFckQsSUFBSSxXQUFXLEtBQUssU0FBUyxFQUFFO1FBQzdCLE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxXQUFXLENBQUMsU0FBUyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sQ0FBQyxDQUFBO1FBQ3JFLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFBO1FBRS9DLElBQUksQ0FBQyxDQUFDLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQTtRQUNsQixJQUFJLENBQUMsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxDQUFDLENBQUE7UUFFbEIsTUFBTSxVQUFVLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFBO1FBQ2hFLE1BQU0sUUFBUSxHQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQTtRQUVoRSxPQUFPLEdBQUcsVUFBVSxJQUFJLFFBQVEsQ0FBQTtLQUNqQztJQUVELE1BQU0sUUFBUSxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsQ0FBQTtJQUVwRCxJQUFJLFFBQVEsSUFBSSxXQUFXLEtBQUssUUFBUSxFQUFFO1FBQ3hDLE1BQU0sRUFBRSxHQUFHLFFBQVEsQ0FBQyxJQUFJLEdBQUcsUUFBUSxDQUFDLEtBQUssR0FBSSxDQUFDLENBQUE7UUFDOUMsTUFBTSxFQUFFLEdBQUcsUUFBUSxDQUFDLEdBQUcsR0FBSSxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQTtRQUU5QyxPQUFPLEdBQUcsRUFBRSxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksRUFBRSxJQUFJLElBQUksQ0FBQyxLQUFLLElBQUksRUFBRSxJQUFJLElBQUksQ0FBQyxHQUFHLElBQUksRUFBRSxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUE7S0FDckY7SUFFRCxJQUFJLFFBQVEsSUFBSSxLQUFLLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsRUFBRTtRQUM1QyxNQUFNLFdBQVcsR0FBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN0RixJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsUUFBUSxDQUFDLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFBO1FBRTdHLE1BQU0sWUFBWSxHQUFHLFdBQVcsR0FBRyxDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFBO1FBRXJFLE9BQU8sR0FBRyxZQUFZLElBQUksV0FBVyxDQUFBO0tBQ3RDO0lBRUQsSUFBSSxZQUFZLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUU7UUFDckMsT0FBTyxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxZQUFZLEVBQUUsV0FBVyxFQUFFLFNBQVMsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFBO0tBQy9IO0lBRUQsT0FBTyxPQUFPLENBQUE7QUFDaEIsQ0FBQztBQUVELE1BQU0sSUFBSSxHQUFHO0lBQ1gsT0FBTztJQUNQLGNBQWM7SUFDZCxPQUFPO0lBQ1AsYUFBYTtJQUNiLGNBQWM7SUFDZCxRQUFRLEVBQUU7UUFDUixPQUFPLEVBQUUsS0FBSztRQUNkLE1BQU0sRUFBRyxJQUFJO1FBQ2IsT0FBTyxFQUFFLFNBQVM7S0FDUztDQUM5QixDQUFBO0FBRUQsZUFBZSxJQUFJLENBQUEiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgSW50ZXJhY3RFdmVudCBmcm9tICdAaW50ZXJhY3Rqcy9jb3JlL0ludGVyYWN0RXZlbnQnXG5pbXBvcnQgeyBTY29wZSB9IGZyb20gJ0BpbnRlcmFjdGpzL2NvcmUvc2NvcGUnXG5pbXBvcnQgKiBhcyB1dGlscyBmcm9tICdAaW50ZXJhY3Rqcy91dGlscydcbmltcG9ydCBEcm9wRXZlbnQgZnJvbSAnLi9Ecm9wRXZlbnQnXG5cbmV4cG9ydCB0eXBlIERyb3B6b25lTWV0aG9kID0gKG9wdGlvbnM/OiBJbnRlcmFjdC5Ecm9wem9uZU9wdGlvbnMgfCBib29sZWFuKSA9PiBJbnRlcmFjdC5JbnRlcmFjdGFibGUgfCBJbnRlcmFjdC5Ecm9wem9uZU9wdGlvbnNcblxuZGVjbGFyZSBtb2R1bGUgJ0BpbnRlcmFjdGpzL2NvcmUvSW50ZXJhY3RhYmxlJyB7XG4gIGludGVyZmFjZSBJbnRlcmFjdGFibGUge1xuICAgIGRyb3B6b25lOiBEcm9wem9uZU1ldGhvZFxuICAgIGRyb3BDaGVjazogKFxuICAgICAgZHJhZ0V2ZW50OiBJbnRlcmFjdEV2ZW50LFxuICAgICAgZXZlbnQ6IEludGVyYWN0LlBvaW50ZXJFdmVudFR5cGUsXG4gICAgICBkcmFnZ2FibGU6IEludGVyYWN0YWJsZSxcbiAgICAgIGRyYWdnYWJsZUVsZW1lbnQ6IEVsZW1lbnQsXG4gICAgICBkcm9wRWxlbWVuOiBFbGVtZW50LFxuICAgICAgcmVjdDogYW55XG4gICAgKSA9PiBib29sZWFuXG4gIH1cbn1cblxuZGVjbGFyZSBtb2R1bGUgJ0BpbnRlcmFjdGpzL2NvcmUvSW50ZXJhY3Rpb24nIHtcbiAgaW50ZXJmYWNlIEludGVyYWN0aW9uIHtcbiAgICBkcm9wU3RhdHVzPzogeyBba2V5OiBzdHJpbmddOiBhbnkgfVxuICB9XG59XG5cbmRlY2xhcmUgbW9kdWxlICdAaW50ZXJhY3Rqcy9jb3JlL2RlZmF1bHRPcHRpb25zJyB7XG4gIGludGVyZmFjZSBBY3Rpb25EZWZhdWx0cyB7XG4gICAgZHJvcD86IEludGVyYWN0LkRyb3B6b25lT3B0aW9uc1xuICB9XG59XG5cbmRlY2xhcmUgbW9kdWxlICdAaW50ZXJhY3Rqcy9jb3JlL3Njb3BlJyB7XG4gIGludGVyZmFjZSBTY29wZSB7XG4gICAgZHluYW1pY0Ryb3A/OiBib29sZWFuXG4gIH1cbn1cblxuZGVjbGFyZSBtb2R1bGUgJ0BpbnRlcmFjdGpzL2ludGVyYWN0L2ludGVyYWN0JyB7XG4gIGludGVyZmFjZSBJbnRlcmFjdFN0YXRpYyB7XG4gICAgZHluYW1pY0Ryb3A6IChuZXdWYWx1ZT86IGJvb2xlYW4pID0+IGJvb2xlYW4gfCBJbnRlcmFjdC5pbnRlcmFjdFxuICB9XG59XG5cbmZ1bmN0aW9uIGluc3RhbGwgKHNjb3BlOiBTY29wZSkge1xuICBjb25zdCB7XG4gICAgYWN0aW9ucyxcbiAgICAvKiogQGxlbmRzIG1vZHVsZTppbnRlcmFjdCAqL1xuICAgIGludGVyYWN0LFxuICAgIC8qKiBAbGVuZHMgSW50ZXJhY3RhYmxlICovXG4gICAgSW50ZXJhY3RhYmxlLFxuICAgIGludGVyYWN0aW9ucyxcbiAgICBkZWZhdWx0cyxcbiAgfSA9IHNjb3BlXG5cbiAgaW50ZXJhY3Rpb25zLnNpZ25hbHMub24oJ2FmdGVyLWFjdGlvbi1zdGFydCcsICh7IGludGVyYWN0aW9uLCBldmVudCwgaUV2ZW50OiBkcmFnRXZlbnQgfSkgPT4ge1xuICAgIGlmIChpbnRlcmFjdGlvbi5wcmVwYXJlZC5uYW1lICE9PSAnZHJhZycpIHsgcmV0dXJuIH1cblxuICAgIGNvbnN0IHsgZHJvcFN0YXR1cyB9ID0gaW50ZXJhY3Rpb25cblxuICAgIC8vIHJlc2V0IGFjdGl2ZSBkcm9wem9uZXNcbiAgICBkcm9wU3RhdHVzLmFjdGl2ZURyb3BzID0gbnVsbFxuICAgIGRyb3BTdGF0dXMuZXZlbnRzID0gbnVsbFxuXG4gICAgaWYgKCFzY29wZS5keW5hbWljRHJvcCkge1xuICAgICAgZHJvcFN0YXR1cy5hY3RpdmVEcm9wcyA9IGdldEFjdGl2ZURyb3BzKHNjb3BlLCBpbnRlcmFjdGlvbi5lbGVtZW50KVxuICAgIH1cblxuICAgIGRyb3BTdGF0dXMuZXZlbnRzID0gZ2V0RHJvcEV2ZW50cyhpbnRlcmFjdGlvbiwgZXZlbnQsIGRyYWdFdmVudClcblxuICAgIGlmIChkcm9wU3RhdHVzLmV2ZW50cy5hY3RpdmF0ZSkge1xuICAgICAgZmlyZUFjdGl2YXRpb25FdmVudHMoZHJvcFN0YXR1cy5hY3RpdmVEcm9wcywgZHJvcFN0YXR1cy5ldmVudHMuYWN0aXZhdGUpXG4gICAgfVxuICB9KVxuXG4gIGludGVyYWN0aW9ucy5zaWduYWxzLm9uKCdhY3Rpb24tbW92ZScsIChhcmcpID0+IG9uRXZlbnRDcmVhdGVkKGFyZywgc2NvcGUpKVxuICBpbnRlcmFjdGlvbnMuc2lnbmFscy5vbignYWN0aW9uLWVuZCcsIChhcmcpID0+IG9uRXZlbnRDcmVhdGVkKGFyZywgc2NvcGUpKVxuXG4gIGludGVyYWN0aW9ucy5zaWduYWxzLm9uKCdhZnRlci1hY3Rpb24tbW92ZScsICh7IGludGVyYWN0aW9uIH0pID0+IHtcbiAgICBpZiAoaW50ZXJhY3Rpb24ucHJlcGFyZWQubmFtZSAhPT0gJ2RyYWcnKSB7IHJldHVybiB9XG5cbiAgICBmaXJlRHJvcEV2ZW50cyhpbnRlcmFjdGlvbiwgaW50ZXJhY3Rpb24uZHJvcFN0YXR1cy5ldmVudHMpXG4gICAgaW50ZXJhY3Rpb24uZHJvcFN0YXR1cy5ldmVudHMgPSB7fVxuICB9KVxuXG4gIGludGVyYWN0aW9ucy5zaWduYWxzLm9uKCdhZnRlci1hY3Rpb24tZW5kJywgKHsgaW50ZXJhY3Rpb24gfSkgPT4ge1xuICAgIGlmIChpbnRlcmFjdGlvbi5wcmVwYXJlZC5uYW1lID09PSAnZHJhZycpIHtcbiAgICAgIGZpcmVEcm9wRXZlbnRzKGludGVyYWN0aW9uLCBpbnRlcmFjdGlvbi5kcm9wU3RhdHVzLmV2ZW50cylcbiAgICB9XG4gIH0pXG5cbiAgaW50ZXJhY3Rpb25zLnNpZ25hbHMub24oJ3N0b3AnLCAoeyBpbnRlcmFjdGlvbiB9KSA9PiB7XG4gICAgaW50ZXJhY3Rpb24uZHJvcFN0YXR1cy5hY3RpdmVEcm9wcyA9IG51bGxcbiAgICBpbnRlcmFjdGlvbi5kcm9wU3RhdHVzLmV2ZW50cyA9IG51bGxcbiAgfSlcblxuICBpbnRlcmFjdGlvbnMuc2lnbmFscy5vbignbmV3JywgKGludGVyYWN0aW9uKSA9PiB7XG4gICAgaW50ZXJhY3Rpb24uZHJvcFN0YXR1cyA9IHtcbiAgICAgIGN1cjoge1xuICAgICAgICBkcm9wem9uZSA6IG51bGwsICAvLyB0aGUgZHJvcHpvbmUgYSBkcmFnIHRhcmdldCBtaWdodCBiZSBkcm9wcGVkIGludG9cbiAgICAgICAgZWxlbWVudCAgOiBudWxsLCAgLy8gdGhlIGVsZW1lbnQgYXQgdGhlIHRpbWUgb2YgY2hlY2tpbmdcbiAgICAgIH0sXG4gICAgICBwcmV2OiB7XG4gICAgICAgIGRyb3B6b25lIDogbnVsbCwgIC8vIHRoZSBkcm9wem9uZSB0aGF0IHdhcyByZWNlbnRseSBkcmFnZ2VkIGF3YXkgZnJvbVxuICAgICAgICBlbGVtZW50ICA6IG51bGwsICAvLyB0aGUgZWxlbWVudCBhdCB0aGUgdGltZSBvZiBjaGVja2luZ1xuICAgICAgfSxcbiAgICAgIHJlamVjdGVkICAgOiBmYWxzZSwgLy8gd2hlYXRoZXIgdGhlIHBvdGVudGlhbCBkcm9wIHdhcyByZWplY3RlZCBmcm9tIGEgbGlzdGVuZXJcbiAgICAgIGV2ZW50cyAgICAgOiBudWxsLCAgLy8gdGhlIGRyb3AgZXZlbnRzIHJlbGF0ZWQgdG8gdGhlIGN1cnJlbnQgZHJhZyBldmVudFxuICAgICAgYWN0aXZlRHJvcHM6IG51bGwsICAvLyBhbiBhcnJheSBvZiB7IGRyb3B6b25lLCBlbGVtZW50LCByZWN0IH1cbiAgICB9XG4gIH0pXG5cbiAgaW50ZXJhY3Rpb25zLnNpZ25hbHMub24oJ3N0b3AnLCAoeyBpbnRlcmFjdGlvbjogeyBkcm9wU3RhdHVzIH0gfSkgPT4ge1xuICAgIGRyb3BTdGF0dXMuY3VyLmRyb3B6b25lID0gZHJvcFN0YXR1cy5jdXIuZWxlbWVudCA9XG4gICAgICBkcm9wU3RhdHVzLnByZXYuZHJvcHpvbmUgPSBkcm9wU3RhdHVzLnByZXYuZWxlbWVudCA9IG51bGxcbiAgICBkcm9wU3RhdHVzLnJlamVjdGVkID0gZmFsc2VcbiAgfSlcblxuICAvKipcbiAgICpcbiAgICogYGBganNcbiAgICogaW50ZXJhY3QoJy5kcm9wJykuZHJvcHpvbmUoe1xuICAgKiAgIGFjY2VwdDogJy5jYW4tZHJvcCcgfHwgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NpbmdsZS1kcm9wJyksXG4gICAqICAgb3ZlcmxhcDogJ3BvaW50ZXInIHx8ICdjZW50ZXInIHx8IHplcm9Ub09uZVxuICAgKiB9XG4gICAqIGBgYFxuICAgKlxuICAgKiBSZXR1cm5zIG9yIHNldHMgd2hldGhlciBkcmFnZ2FibGVzIGNhbiBiZSBkcm9wcGVkIG9udG8gdGhpcyB0YXJnZXQgdG9cbiAgICogdHJpZ2dlciBkcm9wIGV2ZW50c1xuICAgKlxuICAgKiBEcm9wem9uZXMgY2FuIHJlY2VpdmUgdGhlIGZvbGxvd2luZyBldmVudHM6XG4gICAqICAtIGBkcm9wYWN0aXZhdGVgIGFuZCBgZHJvcGRlYWN0aXZhdGVgIHdoZW4gYW4gYWNjZXB0YWJsZSBkcmFnIHN0YXJ0cyBhbmQgZW5kc1xuICAgKiAgLSBgZHJhZ2VudGVyYCBhbmQgYGRyYWdsZWF2ZWAgd2hlbiBhIGRyYWdnYWJsZSBlbnRlcnMgYW5kIGxlYXZlcyB0aGUgZHJvcHpvbmVcbiAgICogIC0gYGRyYWdtb3ZlYCB3aGVuIGEgZHJhZ2dhYmxlIHRoYXQgaGFzIGVudGVyZWQgdGhlIGRyb3B6b25lIGlzIG1vdmVkXG4gICAqICAtIGBkcm9wYCB3aGVuIGEgZHJhZ2dhYmxlIGlzIGRyb3BwZWQgaW50byB0aGlzIGRyb3B6b25lXG4gICAqXG4gICAqIFVzZSB0aGUgYGFjY2VwdGAgb3B0aW9uIHRvIGFsbG93IG9ubHkgZWxlbWVudHMgdGhhdCBtYXRjaCB0aGUgZ2l2ZW4gQ1NTXG4gICAqIHNlbGVjdG9yIG9yIGVsZW1lbnQuIFRoZSB2YWx1ZSBjYW4gYmU6XG4gICAqXG4gICAqICAtICoqYW4gRWxlbWVudCoqIC0gb25seSB0aGF0IGVsZW1lbnQgY2FuIGJlIGRyb3BwZWQgaW50byB0aGlzIGRyb3B6b25lLlxuICAgKiAgLSAqKmEgc3RyaW5nKiosIC0gdGhlIGVsZW1lbnQgYmVpbmcgZHJhZ2dlZCBtdXN0IG1hdGNoIGl0IGFzIGEgQ1NTIHNlbGVjdG9yLlxuICAgKiAgLSAqKmBudWxsYCoqIC0gYWNjZXB0IG9wdGlvbnMgaXMgY2xlYXJlZCAtIGl0IGFjY2VwdHMgYW55IGVsZW1lbnQuXG4gICAqXG4gICAqIFVzZSB0aGUgYG92ZXJsYXBgIG9wdGlvbiB0byBzZXQgaG93IGRyb3BzIGFyZSBjaGVja2VkIGZvci4gVGhlIGFsbG93ZWRcbiAgICogdmFsdWVzIGFyZTpcbiAgICpcbiAgICogICAtIGAncG9pbnRlcidgLCB0aGUgcG9pbnRlciBtdXN0IGJlIG92ZXIgdGhlIGRyb3B6b25lIChkZWZhdWx0KVxuICAgKiAgIC0gYCdjZW50ZXInYCwgdGhlIGRyYWdnYWJsZSBlbGVtZW50J3MgY2VudGVyIG11c3QgYmUgb3ZlciB0aGUgZHJvcHpvbmVcbiAgICogICAtIGEgbnVtYmVyIGZyb20gMC0xIHdoaWNoIGlzIHRoZSBgKGludGVyc2VjdGlvbiBhcmVhKSAvIChkcmFnZ2FibGUgYXJlYSlgLlxuICAgKiAgIGUuZy4gYDAuNWAgZm9yIGRyb3AgdG8gaGFwcGVuIHdoZW4gaGFsZiBvZiB0aGUgYXJlYSBvZiB0aGUgZHJhZ2dhYmxlIGlzXG4gICAqICAgb3ZlciB0aGUgZHJvcHpvbmVcbiAgICpcbiAgICogVXNlIHRoZSBgY2hlY2tlcmAgb3B0aW9uIHRvIHNwZWNpZnkgYSBmdW5jdGlvbiB0byBjaGVjayBpZiBhIGRyYWdnZWQgZWxlbWVudFxuICAgKiBpcyBvdmVyIHRoaXMgSW50ZXJhY3RhYmxlLlxuICAgKlxuICAgKiBAcGFyYW0ge2Jvb2xlYW4gfCBvYmplY3QgfCBudWxsfSBbb3B0aW9uc10gVGhlIG5ldyBvcHRpb25zIHRvIGJlIHNldC5cbiAgICogQHJldHVybiB7Ym9vbGVhbiB8IEludGVyYWN0YWJsZX0gVGhlIGN1cnJlbnQgc2V0dGluZyBvciB0aGlzIEludGVyYWN0YWJsZVxuICAgKi9cbiAgSW50ZXJhY3RhYmxlLnByb3RvdHlwZS5kcm9wem9uZSA9IGZ1bmN0aW9uICh0aGlzOiBJbnRlcmFjdC5JbnRlcmFjdGFibGUsIG9wdGlvbnMpIHtcbiAgICByZXR1cm4gZHJvcHpvbmVNZXRob2QodGhpcywgb3B0aW9ucylcbiAgfVxuXG4gIC8qKlxuICAgKiBgYGBqc1xuICAgKiBpbnRlcmFjdCh0YXJnZXQpXG4gICAqIC5kcm9wQ2hlY2tlcihmdW5jdGlvbihkcmFnRXZlbnQsICAgICAgICAgLy8gcmVsYXRlZCBkcmFnbW92ZSBvciBkcmFnZW5kIGV2ZW50XG4gICAqICAgICAgICAgICAgICAgICAgICAgICBldmVudCwgICAgICAgICAgICAgLy8gVG91Y2hFdmVudC9Qb2ludGVyRXZlbnQvTW91c2VFdmVudFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgZHJvcHBlZCwgICAgICAgICAgIC8vIGJvb2wgcmVzdWx0IG9mIHRoZSBkZWZhdWx0IGNoZWNrZXJcbiAgICogICAgICAgICAgICAgICAgICAgICAgIGRyb3B6b25lLCAgICAgICAgICAvLyBkcm9wem9uZSBJbnRlcmFjdGFibGVcbiAgICogICAgICAgICAgICAgICAgICAgICAgIGRyb3BFbGVtZW50LCAgICAgICAvLyBkcm9wem9uZSBlbGVtbnRcbiAgICogICAgICAgICAgICAgICAgICAgICAgIGRyYWdnYWJsZSwgICAgICAgICAvLyBkcmFnZ2FibGUgSW50ZXJhY3RhYmxlXG4gICAqICAgICAgICAgICAgICAgICAgICAgICBkcmFnZ2FibGVFbGVtZW50KSB7Ly8gZHJhZ2dhYmxlIGVsZW1lbnRcbiAgICpcbiAgICogICByZXR1cm4gZHJvcHBlZCAmJiBldmVudC50YXJnZXQuaGFzQXR0cmlidXRlKCdhbGxvdy1kcm9wJyk7XG4gICAqIH1cbiAgICogYGBgXG4gICAqL1xuICBJbnRlcmFjdGFibGUucHJvdG90eXBlLmRyb3BDaGVjayA9IGZ1bmN0aW9uICh0aGlzOiBJbnRlcmFjdC5JbnRlcmFjdGFibGUsIGRyYWdFdmVudCwgZXZlbnQsIGRyYWdnYWJsZSwgZHJhZ2dhYmxlRWxlbWVudCwgZHJvcEVsZW1lbnQsIHJlY3QpIHtcbiAgICByZXR1cm4gZHJvcENoZWNrTWV0aG9kKHRoaXMsIGRyYWdFdmVudCwgZXZlbnQsIGRyYWdnYWJsZSwgZHJhZ2dhYmxlRWxlbWVudCwgZHJvcEVsZW1lbnQsIHJlY3QpXG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBvciBzZXRzIHdoZXRoZXIgdGhlIGRpbWVuc2lvbnMgb2YgZHJvcHpvbmUgZWxlbWVudHMgYXJlIGNhbGN1bGF0ZWRcbiAgICogb24gZXZlcnkgZHJhZ21vdmUgb3Igb25seSBvbiBkcmFnc3RhcnQgZm9yIHRoZSBkZWZhdWx0IGRyb3BDaGVja2VyXG4gICAqXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gW25ld1ZhbHVlXSBUcnVlIHRvIGNoZWNrIG9uIGVhY2ggbW92ZS4gRmFsc2UgdG8gY2hlY2sgb25seVxuICAgKiBiZWZvcmUgc3RhcnRcbiAgICogQHJldHVybiB7Ym9vbGVhbiB8IGludGVyYWN0fSBUaGUgY3VycmVudCBzZXR0aW5nIG9yIGludGVyYWN0XG4gICAqL1xuICBpbnRlcmFjdC5keW5hbWljRHJvcCA9IGZ1bmN0aW9uIChuZXdWYWx1ZT86IGJvb2xlYW4pIHtcbiAgICBpZiAodXRpbHMuaXMuYm9vbChuZXdWYWx1ZSkpIHtcbiAgICAgIC8vIGlmIChkcmFnZ2luZyAmJiBzY29wZS5keW5hbWljRHJvcCAhPT0gbmV3VmFsdWUgJiYgIW5ld1ZhbHVlKSB7XG4gICAgICAvLyAgY2FsY1JlY3RzKGRyb3B6b25lcyk7XG4gICAgICAvLyB9XG5cbiAgICAgIHNjb3BlLmR5bmFtaWNEcm9wID0gbmV3VmFsdWVcblxuICAgICAgcmV0dXJuIGludGVyYWN0XG4gICAgfVxuICAgIHJldHVybiBzY29wZS5keW5hbWljRHJvcFxuICB9XG5cbiAgdXRpbHMuYXJyLm1lcmdlKGFjdGlvbnMuZXZlbnRUeXBlcywgW1xuICAgICdkcmFnZW50ZXInLFxuICAgICdkcmFnbGVhdmUnLFxuICAgICdkcm9wYWN0aXZhdGUnLFxuICAgICdkcm9wZGVhY3RpdmF0ZScsXG4gICAgJ2Ryb3Btb3ZlJyxcbiAgICAnZHJvcCcsXG4gIF0pXG4gIGFjdGlvbnMubWV0aG9kRGljdC5kcm9wID0gJ2Ryb3B6b25lJ1xuXG4gIHNjb3BlLmR5bmFtaWNEcm9wID0gZmFsc2VcblxuICBkZWZhdWx0cy5hY3Rpb25zLmRyb3AgPSBkcm9wLmRlZmF1bHRzXG59XG5cbmZ1bmN0aW9uIGNvbGxlY3REcm9wcyAoeyBpbnRlcmFjdGFibGVzIH0sIGRyYWdnYWJsZUVsZW1lbnQpIHtcbiAgY29uc3QgZHJvcHMgPSBbXVxuXG4gIC8vIGNvbGxlY3QgYWxsIGRyb3B6b25lcyBhbmQgdGhlaXIgZWxlbWVudHMgd2hpY2ggcXVhbGlmeSBmb3IgYSBkcm9wXG4gIGZvciAoY29uc3QgZHJvcHpvbmUgb2YgaW50ZXJhY3RhYmxlcy5saXN0KSB7XG4gICAgaWYgKCFkcm9wem9uZS5vcHRpb25zLmRyb3AuZW5hYmxlZCkgeyBjb250aW51ZSB9XG5cbiAgICBjb25zdCBhY2NlcHQgPSBkcm9wem9uZS5vcHRpb25zLmRyb3AuYWNjZXB0XG5cbiAgICAvLyB0ZXN0IHRoZSBkcmFnZ2FibGUgZHJhZ2dhYmxlRWxlbWVudCBhZ2FpbnN0IHRoZSBkcm9wem9uZSdzIGFjY2VwdCBzZXR0aW5nXG4gICAgaWYgKCh1dGlscy5pcy5lbGVtZW50KGFjY2VwdCkgJiYgYWNjZXB0ICE9PSBkcmFnZ2FibGVFbGVtZW50KSB8fFxuICAgICAgICAodXRpbHMuaXMuc3RyaW5nKGFjY2VwdCkgJiZcbiAgICAgICAgIXV0aWxzLmRvbS5tYXRjaGVzU2VsZWN0b3IoZHJhZ2dhYmxlRWxlbWVudCwgYWNjZXB0KSkgfHxcbiAgICAgICAgKHV0aWxzLmlzLmZ1bmMoYWNjZXB0KSAmJiAhYWNjZXB0KHsgZHJvcHpvbmUsIGRyYWdnYWJsZUVsZW1lbnQgfSkpKSB7XG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIC8vIHF1ZXJ5IGZvciBuZXcgZWxlbWVudHMgaWYgbmVjZXNzYXJ5XG4gICAgY29uc3QgZHJvcEVsZW1lbnRzID0gdXRpbHMuaXMuc3RyaW5nKGRyb3B6b25lLnRhcmdldClcbiAgICAgID8gZHJvcHpvbmUuX2NvbnRleHQucXVlcnlTZWxlY3RvckFsbChkcm9wem9uZS50YXJnZXQpXG4gICAgICA6IHV0aWxzLmlzLmFycmF5KGRyb3B6b25lLnRhcmdldCkgPyBkcm9wem9uZS50YXJnZXQgOiBbZHJvcHpvbmUudGFyZ2V0XVxuXG4gICAgZm9yIChjb25zdCBkcm9wem9uZUVsZW1lbnQgb2YgZHJvcEVsZW1lbnRzKSB7XG4gICAgICBpZiAoZHJvcHpvbmVFbGVtZW50ICE9PSBkcmFnZ2FibGVFbGVtZW50KSB7XG4gICAgICAgIGRyb3BzLnB1c2goe1xuICAgICAgICAgIGRyb3B6b25lLFxuICAgICAgICAgIGVsZW1lbnQ6IGRyb3B6b25lRWxlbWVudCxcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gZHJvcHNcbn1cblxuZnVuY3Rpb24gZmlyZUFjdGl2YXRpb25FdmVudHMgKGFjdGl2ZURyb3BzLCBldmVudCkge1xuICAvLyBsb29wIHRocm91Z2ggYWxsIGFjdGl2ZSBkcm9wem9uZXMgYW5kIHRyaWdnZXIgZXZlbnRcbiAgZm9yIChjb25zdCB7IGRyb3B6b25lLCBlbGVtZW50IH0gb2YgYWN0aXZlRHJvcHMpIHtcbiAgICBldmVudC5kcm9wem9uZSA9IGRyb3B6b25lXG5cbiAgICAvLyBzZXQgY3VycmVudCBlbGVtZW50IGFzIGV2ZW50IHRhcmdldFxuICAgIGV2ZW50LnRhcmdldCA9IGVsZW1lbnRcbiAgICBkcm9wem9uZS5maXJlKGV2ZW50KVxuICAgIGV2ZW50LnByb3BhZ2F0aW9uU3RvcHBlZCA9IGV2ZW50LmltbWVkaWF0ZVByb3BhZ2F0aW9uU3RvcHBlZCA9IGZhbHNlXG4gIH1cbn1cblxuLy8gcmV0dXJuIGEgbmV3IGFycmF5IG9mIHBvc3NpYmxlIGRyb3BzLiBnZXRBY3RpdmVEcm9wcyBzaG91bGQgYWx3YXlzIGJlXG4vLyBjYWxsZWQgd2hlbiBhIGRyYWcgaGFzIGp1c3Qgc3RhcnRlZCBvciBhIGRyYWcgZXZlbnQgaGFwcGVucyB3aGlsZVxuLy8gZHluYW1pY0Ryb3AgaXMgdHJ1ZVxuZnVuY3Rpb24gZ2V0QWN0aXZlRHJvcHMgKHNjb3BlOiBTY29wZSwgZHJhZ0VsZW1lbnQ6IEVsZW1lbnQpIHtcbiAgLy8gZ2V0IGRyb3B6b25lcyBhbmQgdGhlaXIgZWxlbWVudHMgdGhhdCBjb3VsZCByZWNlaXZlIHRoZSBkcmFnZ2FibGVcbiAgY29uc3QgYWN0aXZlRHJvcHMgPSBjb2xsZWN0RHJvcHMoc2NvcGUsIGRyYWdFbGVtZW50KVxuXG4gIGZvciAoY29uc3QgYWN0aXZlRHJvcCBvZiBhY3RpdmVEcm9wcykge1xuICAgIGFjdGl2ZURyb3AucmVjdCA9IGFjdGl2ZURyb3AuZHJvcHpvbmUuZ2V0UmVjdChhY3RpdmVEcm9wLmVsZW1lbnQpXG4gIH1cblxuICByZXR1cm4gYWN0aXZlRHJvcHNcbn1cblxuZnVuY3Rpb24gZ2V0RHJvcCAoeyBkcm9wU3RhdHVzLCB0YXJnZXQ6IGRyYWdnYWJsZSwgZWxlbWVudDogZHJhZ0VsZW1lbnQgfSwgZHJhZ0V2ZW50LCBwb2ludGVyRXZlbnQpIHtcbiAgY29uc3QgdmFsaWREcm9wcyA9IFtdXG5cbiAgLy8gY29sbGVjdCBhbGwgZHJvcHpvbmVzIGFuZCB0aGVpciBlbGVtZW50cyB3aGljaCBxdWFsaWZ5IGZvciBhIGRyb3BcbiAgZm9yIChjb25zdCB7IGRyb3B6b25lLCBlbGVtZW50OiBkcm9wem9uZUVsZW1lbnQsIHJlY3QgfSBvZiBkcm9wU3RhdHVzLmFjdGl2ZURyb3BzKSB7XG4gICAgdmFsaWREcm9wcy5wdXNoKGRyb3B6b25lLmRyb3BDaGVjayhkcmFnRXZlbnQsIHBvaW50ZXJFdmVudCwgZHJhZ2dhYmxlLCBkcmFnRWxlbWVudCwgZHJvcHpvbmVFbGVtZW50LCByZWN0KVxuICAgICAgPyBkcm9wem9uZUVsZW1lbnRcbiAgICAgIDogbnVsbClcbiAgfVxuXG4gIC8vIGdldCB0aGUgbW9zdCBhcHByb3ByaWF0ZSBkcm9wem9uZSBiYXNlZCBvbiBET00gZGVwdGggYW5kIG9yZGVyXG4gIGNvbnN0IGRyb3BJbmRleCA9IHV0aWxzLmRvbS5pbmRleE9mRGVlcGVzdEVsZW1lbnQodmFsaWREcm9wcylcblxuICByZXR1cm4gZHJvcFN0YXR1cy5hY3RpdmVEcm9wc1tkcm9wSW5kZXhdIHx8IG51bGxcbn1cblxuZnVuY3Rpb24gZ2V0RHJvcEV2ZW50cyAoaW50ZXJhY3Rpb24sIF9wb2ludGVyRXZlbnQsIGRyYWdFdmVudCkge1xuICBjb25zdCB7IGRyb3BTdGF0dXMgfSA9IGludGVyYWN0aW9uXG4gIGNvbnN0IGRyb3BFdmVudHMgPSB7XG4gICAgZW50ZXIgICAgIDogbnVsbCxcbiAgICBsZWF2ZSAgICAgOiBudWxsLFxuICAgIGFjdGl2YXRlICA6IG51bGwsXG4gICAgZGVhY3RpdmF0ZTogbnVsbCxcbiAgICBtb3ZlICAgICAgOiBudWxsLFxuICAgIGRyb3AgICAgICA6IG51bGwsXG4gIH1cblxuICBpZiAoZHJhZ0V2ZW50LnR5cGUgPT09ICdkcmFnc3RhcnQnKSB7XG4gICAgZHJvcEV2ZW50cy5hY3RpdmF0ZSA9IG5ldyBEcm9wRXZlbnQoZHJvcFN0YXR1cywgZHJhZ0V2ZW50LCAnZHJvcGFjdGl2YXRlJylcblxuICAgIGRyb3BFdmVudHMuYWN0aXZhdGUudGFyZ2V0ICAgPSBudWxsXG4gICAgZHJvcEV2ZW50cy5hY3RpdmF0ZS5kcm9wem9uZSA9IG51bGxcbiAgfVxuICBpZiAoZHJhZ0V2ZW50LnR5cGUgPT09ICdkcmFnZW5kJykge1xuICAgIGRyb3BFdmVudHMuZGVhY3RpdmF0ZSA9IG5ldyBEcm9wRXZlbnQoZHJvcFN0YXR1cywgZHJhZ0V2ZW50LCAnZHJvcGRlYWN0aXZhdGUnKVxuXG4gICAgZHJvcEV2ZW50cy5kZWFjdGl2YXRlLnRhcmdldCAgID0gbnVsbFxuICAgIGRyb3BFdmVudHMuZGVhY3RpdmF0ZS5kcm9wem9uZSA9IG51bGxcbiAgfVxuXG4gIGlmIChkcm9wU3RhdHVzLnJlamVjdGVkKSB7XG4gICAgcmV0dXJuIGRyb3BFdmVudHNcbiAgfVxuXG4gIGlmIChkcm9wU3RhdHVzLmN1ci5lbGVtZW50ICE9PSBkcm9wU3RhdHVzLnByZXYuZWxlbWVudCkge1xuICAgIC8vIGlmIHRoZXJlIHdhcyBhIHByZXZpb3VzIGRyb3B6b25lLCBjcmVhdGUgYSBkcmFnbGVhdmUgZXZlbnRcbiAgICBpZiAoZHJvcFN0YXR1cy5wcmV2LmRyb3B6b25lKSB7XG4gICAgICBkcm9wRXZlbnRzLmxlYXZlID0gbmV3IERyb3BFdmVudChkcm9wU3RhdHVzLCBkcmFnRXZlbnQsICdkcmFnbGVhdmUnKVxuXG4gICAgICBkcmFnRXZlbnQuZHJhZ0xlYXZlICAgID0gZHJvcEV2ZW50cy5sZWF2ZS50YXJnZXQgICA9IGRyb3BTdGF0dXMucHJldi5lbGVtZW50XG4gICAgICBkcmFnRXZlbnQucHJldkRyb3B6b25lID0gZHJvcEV2ZW50cy5sZWF2ZS5kcm9wem9uZSA9IGRyb3BTdGF0dXMucHJldi5kcm9wem9uZVxuICAgIH1cbiAgICAvLyBpZiBkcm9wem9uZSBpcyBub3QgbnVsbCwgY3JlYXRlIGEgZHJhZ2VudGVyIGV2ZW50XG4gICAgaWYgKGRyb3BTdGF0dXMuY3VyLmRyb3B6b25lKSB7XG4gICAgICBkcm9wRXZlbnRzLmVudGVyID0gbmV3IERyb3BFdmVudChkcm9wU3RhdHVzLCBkcmFnRXZlbnQsICdkcmFnZW50ZXInKVxuXG4gICAgICBkcmFnRXZlbnQuZHJhZ0VudGVyID0gZHJvcFN0YXR1cy5jdXIuZWxlbWVudFxuICAgICAgZHJhZ0V2ZW50LmRyb3B6b25lID0gZHJvcFN0YXR1cy5jdXIuZHJvcHpvbmVcbiAgICB9XG4gIH1cblxuICBpZiAoZHJhZ0V2ZW50LnR5cGUgPT09ICdkcmFnZW5kJyAmJiBkcm9wU3RhdHVzLmN1ci5kcm9wem9uZSkge1xuICAgIGRyb3BFdmVudHMuZHJvcCA9IG5ldyBEcm9wRXZlbnQoZHJvcFN0YXR1cywgZHJhZ0V2ZW50LCAnZHJvcCcpXG5cbiAgICBkcmFnRXZlbnQuZHJvcHpvbmUgPSBkcm9wU3RhdHVzLmN1ci5kcm9wem9uZVxuICAgIGRyYWdFdmVudC5yZWxhdGVkVGFyZ2V0ID0gZHJvcFN0YXR1cy5jdXIuZWxlbWVudFxuICB9XG4gIGlmIChkcmFnRXZlbnQudHlwZSA9PT0gJ2RyYWdtb3ZlJyAmJiBkcm9wU3RhdHVzLmN1ci5kcm9wem9uZSkge1xuICAgIGRyb3BFdmVudHMubW92ZSA9IG5ldyBEcm9wRXZlbnQoZHJvcFN0YXR1cywgZHJhZ0V2ZW50LCAnZHJvcG1vdmUnKVxuXG4gICAgZHJvcEV2ZW50cy5tb3ZlLmRyYWdtb3ZlID0gZHJhZ0V2ZW50XG4gICAgZHJhZ0V2ZW50LmRyb3B6b25lID0gZHJvcFN0YXR1cy5jdXIuZHJvcHpvbmVcbiAgfVxuXG4gIHJldHVybiBkcm9wRXZlbnRzXG59XG5cbmZ1bmN0aW9uIGZpcmVEcm9wRXZlbnRzIChpbnRlcmFjdGlvbiwgZXZlbnRzKSB7XG4gIGNvbnN0IHsgZHJvcFN0YXR1cyB9ID0gaW50ZXJhY3Rpb25cbiAgY29uc3Qge1xuICAgIGFjdGl2ZURyb3BzLFxuICAgIGN1cixcbiAgICBwcmV2LFxuICB9ID0gZHJvcFN0YXR1c1xuXG4gIGlmIChldmVudHMubGVhdmUpIHsgcHJldi5kcm9wem9uZS5maXJlKGV2ZW50cy5sZWF2ZSkgfVxuICBpZiAoZXZlbnRzLm1vdmUpIHsgY3VyLmRyb3B6b25lLmZpcmUoZXZlbnRzLm1vdmUpIH1cbiAgaWYgKGV2ZW50cy5lbnRlcikgeyBjdXIuZHJvcHpvbmUuZmlyZShldmVudHMuZW50ZXIpIH1cbiAgaWYgKGV2ZW50cy5kcm9wKSB7IGN1ci5kcm9wem9uZS5maXJlKGV2ZW50cy5kcm9wKSB9XG5cbiAgaWYgKGV2ZW50cy5kZWFjdGl2YXRlKSB7XG4gICAgZmlyZUFjdGl2YXRpb25FdmVudHMoYWN0aXZlRHJvcHMsIGV2ZW50cy5kZWFjdGl2YXRlKVxuICB9XG5cbiAgZHJvcFN0YXR1cy5wcmV2LmRyb3B6b25lICA9IGN1ci5kcm9wem9uZVxuICBkcm9wU3RhdHVzLnByZXYuZWxlbWVudCA9IGN1ci5lbGVtZW50XG59XG5cbmZ1bmN0aW9uIG9uRXZlbnRDcmVhdGVkICh7IGludGVyYWN0aW9uLCBpRXZlbnQsIGV2ZW50IH0sIHNjb3BlKSB7XG4gIGlmIChpRXZlbnQudHlwZSAhPT0gJ2RyYWdtb3ZlJyAmJiBpRXZlbnQudHlwZSAhPT0gJ2RyYWdlbmQnKSB7IHJldHVybiB9XG5cbiAgY29uc3QgeyBkcm9wU3RhdHVzIH0gPSBpbnRlcmFjdGlvblxuXG4gIGlmIChzY29wZS5keW5hbWljRHJvcCkge1xuICAgIGRyb3BTdGF0dXMuYWN0aXZlRHJvcHMgPSBnZXRBY3RpdmVEcm9wcyhzY29wZSwgaW50ZXJhY3Rpb24uZWxlbWVudClcbiAgfVxuXG4gIGNvbnN0IGRyYWdFdmVudCA9IGlFdmVudFxuICBjb25zdCBkcm9wUmVzdWx0ID0gZ2V0RHJvcChpbnRlcmFjdGlvbiwgZHJhZ0V2ZW50LCBldmVudClcblxuICAvLyB1cGRhdGUgcmVqZWN0ZWQgc3RhdHVzXG4gIGRyb3BTdGF0dXMucmVqZWN0ZWQgPSBkcm9wU3RhdHVzLnJlamVjdGVkICYmXG4gICAgISFkcm9wUmVzdWx0ICYmXG4gICAgZHJvcFJlc3VsdC5kcm9wem9uZSA9PT0gZHJvcFN0YXR1cy5jdXIuZHJvcHpvbmUgJiZcbiAgICBkcm9wUmVzdWx0LmVsZW1lbnQgPT09IGRyb3BTdGF0dXMuY3VyLmVsZW1lbnRcblxuICBkcm9wU3RhdHVzLmN1ci5kcm9wem9uZSAgPSBkcm9wUmVzdWx0ICYmIGRyb3BSZXN1bHQuZHJvcHpvbmVcbiAgZHJvcFN0YXR1cy5jdXIuZWxlbWVudCA9IGRyb3BSZXN1bHQgJiYgZHJvcFJlc3VsdC5lbGVtZW50XG5cbiAgZHJvcFN0YXR1cy5ldmVudHMgPSBnZXREcm9wRXZlbnRzKGludGVyYWN0aW9uLCBldmVudCwgZHJhZ0V2ZW50KVxufVxuXG5mdW5jdGlvbiBkcm9wem9uZU1ldGhvZCAoaW50ZXJhY3RhYmxlOiBJbnRlcmFjdC5JbnRlcmFjdGFibGUsIG9wdGlvbnM6IEludGVyYWN0LkRyb3B6b25lT3B0aW9ucyB8IGJvb2xlYW4pIHtcbiAgaWYgKHV0aWxzLmlzLm9iamVjdChvcHRpb25zKSkge1xuICAgIGludGVyYWN0YWJsZS5vcHRpb25zLmRyb3AuZW5hYmxlZCA9IG9wdGlvbnMuZW5hYmxlZCAhPT0gZmFsc2VcblxuICAgIGlmIChvcHRpb25zLmxpc3RlbmVycykge1xuICAgICAgY29uc3Qgbm9ybWFsaXplZCA9IHV0aWxzLm5vcm1hbGl6ZUxpc3RlbmVycyhvcHRpb25zLmxpc3RlbmVycylcbiAgICAgIC8vIHJlbmFtZSAnZHJvcCcgdG8gJycgYXMgaXQgd2lsbCBiZSBwcmVmaXhlZCB3aXRoICdkcm9wJ1xuICAgICAgY29uc3QgY29ycmVjdGVkID0gT2JqZWN0LmtleXMobm9ybWFsaXplZCkucmVkdWNlKChhY2MsIHR5cGUpID0+IHtcbiAgICAgICAgY29uc3QgY29ycmVjdGVkVHlwZSA9IC9eKGVudGVyfGxlYXZlKS8udGVzdCh0eXBlKVxuICAgICAgICAgID8gYGRyYWcke3R5cGV9YFxuICAgICAgICAgIDogL14oYWN0aXZhdGV8ZGVhY3RpdmF0ZXxtb3ZlKS8udGVzdCh0eXBlKVxuICAgICAgICAgICAgPyBgZHJvcCR7dHlwZX1gXG4gICAgICAgICAgICA6IHR5cGVcblxuICAgICAgICBhY2NbY29ycmVjdGVkVHlwZV0gPSBub3JtYWxpemVkW3R5cGVdXG5cbiAgICAgICAgcmV0dXJuIGFjY1xuICAgICAgfSwge30pXG5cbiAgICAgIGludGVyYWN0YWJsZS5vZmYoaW50ZXJhY3RhYmxlLm9wdGlvbnMuZHJvcC5saXN0ZW5lcnMpXG4gICAgICBpbnRlcmFjdGFibGUub24oY29ycmVjdGVkKVxuICAgICAgaW50ZXJhY3RhYmxlLm9wdGlvbnMuZHJvcC5saXN0ZW5lcnMgPSBjb3JyZWN0ZWRcbiAgICB9XG5cbiAgICBpZiAodXRpbHMuaXMuZnVuYyhvcHRpb25zLm9uZHJvcCkpIHsgaW50ZXJhY3RhYmxlLm9uKCdkcm9wJywgb3B0aW9ucy5vbmRyb3ApIH1cbiAgICBpZiAodXRpbHMuaXMuZnVuYyhvcHRpb25zLm9uZHJvcGFjdGl2YXRlKSkgeyBpbnRlcmFjdGFibGUub24oJ2Ryb3BhY3RpdmF0ZScsIG9wdGlvbnMub25kcm9wYWN0aXZhdGUpIH1cbiAgICBpZiAodXRpbHMuaXMuZnVuYyhvcHRpb25zLm9uZHJvcGRlYWN0aXZhdGUpKSB7IGludGVyYWN0YWJsZS5vbignZHJvcGRlYWN0aXZhdGUnLCBvcHRpb25zLm9uZHJvcGRlYWN0aXZhdGUpIH1cbiAgICBpZiAodXRpbHMuaXMuZnVuYyhvcHRpb25zLm9uZHJhZ2VudGVyKSkgeyBpbnRlcmFjdGFibGUub24oJ2RyYWdlbnRlcicsIG9wdGlvbnMub25kcmFnZW50ZXIpIH1cbiAgICBpZiAodXRpbHMuaXMuZnVuYyhvcHRpb25zLm9uZHJhZ2xlYXZlKSkgeyBpbnRlcmFjdGFibGUub24oJ2RyYWdsZWF2ZScsIG9wdGlvbnMub25kcmFnbGVhdmUpIH1cbiAgICBpZiAodXRpbHMuaXMuZnVuYyhvcHRpb25zLm9uZHJvcG1vdmUpKSB7IGludGVyYWN0YWJsZS5vbignZHJvcG1vdmUnLCBvcHRpb25zLm9uZHJvcG1vdmUpIH1cblxuICAgIGlmICgvXihwb2ludGVyfGNlbnRlcikkLy50ZXN0KG9wdGlvbnMub3ZlcmxhcCBhcyBzdHJpbmcpKSB7XG4gICAgICBpbnRlcmFjdGFibGUub3B0aW9ucy5kcm9wLm92ZXJsYXAgPSBvcHRpb25zLm92ZXJsYXBcbiAgICB9XG4gICAgZWxzZSBpZiAodXRpbHMuaXMubnVtYmVyKG9wdGlvbnMub3ZlcmxhcCkpIHtcbiAgICAgIGludGVyYWN0YWJsZS5vcHRpb25zLmRyb3Aub3ZlcmxhcCA9IE1hdGgubWF4KE1hdGgubWluKDEsIG9wdGlvbnMub3ZlcmxhcCksIDApXG4gICAgfVxuICAgIGlmICgnYWNjZXB0JyBpbiBvcHRpb25zKSB7XG4gICAgICBpbnRlcmFjdGFibGUub3B0aW9ucy5kcm9wLmFjY2VwdCA9IG9wdGlvbnMuYWNjZXB0XG4gICAgfVxuICAgIGlmICgnY2hlY2tlcicgaW4gb3B0aW9ucykge1xuICAgICAgaW50ZXJhY3RhYmxlLm9wdGlvbnMuZHJvcC5jaGVja2VyID0gb3B0aW9ucy5jaGVja2VyXG4gICAgfVxuXG4gICAgcmV0dXJuIGludGVyYWN0YWJsZVxuICB9XG5cbiAgaWYgKHV0aWxzLmlzLmJvb2wob3B0aW9ucykpIHtcbiAgICBpbnRlcmFjdGFibGUub3B0aW9ucy5kcm9wLmVuYWJsZWQgPSBvcHRpb25zXG5cbiAgICByZXR1cm4gaW50ZXJhY3RhYmxlXG4gIH1cblxuICByZXR1cm4gaW50ZXJhY3RhYmxlLm9wdGlvbnMuZHJvcFxufVxuXG5mdW5jdGlvbiBkcm9wQ2hlY2tNZXRob2QgKFxuICBpbnRlcmFjdGFibGU6IEludGVyYWN0LkludGVyYWN0YWJsZSxcbiAgZHJhZ0V2ZW50OiBJbnRlcmFjdEV2ZW50LFxuICBldmVudDogSW50ZXJhY3QuUG9pbnRlckV2ZW50VHlwZSxcbiAgZHJhZ2dhYmxlOiBJbnRlcmFjdC5JbnRlcmFjdGFibGUsXG4gIGRyYWdnYWJsZUVsZW1lbnQ6IEVsZW1lbnQsXG4gIGRyb3BFbGVtZW50OiBFbGVtZW50LFxuICByZWN0OiBhbnlcbikge1xuICBsZXQgZHJvcHBlZCA9IGZhbHNlXG5cbiAgLy8gaWYgdGhlIGRyb3B6b25lIGhhcyBubyByZWN0IChlZy4gZGlzcGxheTogbm9uZSlcbiAgLy8gY2FsbCB0aGUgY3VzdG9tIGRyb3BDaGVja2VyIG9yIGp1c3QgcmV0dXJuIGZhbHNlXG4gIGlmICghKHJlY3QgPSByZWN0IHx8IGludGVyYWN0YWJsZS5nZXRSZWN0KGRyb3BFbGVtZW50KSkpIHtcbiAgICByZXR1cm4gKGludGVyYWN0YWJsZS5vcHRpb25zLmRyb3AuY2hlY2tlclxuICAgICAgPyBpbnRlcmFjdGFibGUub3B0aW9ucy5kcm9wLmNoZWNrZXIoZHJhZ0V2ZW50LCBldmVudCwgZHJvcHBlZCwgaW50ZXJhY3RhYmxlLCBkcm9wRWxlbWVudCwgZHJhZ2dhYmxlLCBkcmFnZ2FibGVFbGVtZW50KVxuICAgICAgOiBmYWxzZSlcbiAgfVxuXG4gIGNvbnN0IGRyb3BPdmVybGFwID0gaW50ZXJhY3RhYmxlLm9wdGlvbnMuZHJvcC5vdmVybGFwXG5cbiAgaWYgKGRyb3BPdmVybGFwID09PSAncG9pbnRlcicpIHtcbiAgICBjb25zdCBvcmlnaW4gPSB1dGlscy5nZXRPcmlnaW5YWShkcmFnZ2FibGUsIGRyYWdnYWJsZUVsZW1lbnQsICdkcmFnJylcbiAgICBjb25zdCBwYWdlID0gdXRpbHMucG9pbnRlci5nZXRQYWdlWFkoZHJhZ0V2ZW50KVxuXG4gICAgcGFnZS54ICs9IG9yaWdpbi54XG4gICAgcGFnZS55ICs9IG9yaWdpbi55XG5cbiAgICBjb25zdCBob3Jpem9udGFsID0gKHBhZ2UueCA+IHJlY3QubGVmdCkgJiYgKHBhZ2UueCA8IHJlY3QucmlnaHQpXG4gICAgY29uc3QgdmVydGljYWwgICA9IChwYWdlLnkgPiByZWN0LnRvcCkgJiYgKHBhZ2UueSA8IHJlY3QuYm90dG9tKVxuXG4gICAgZHJvcHBlZCA9IGhvcml6b250YWwgJiYgdmVydGljYWxcbiAgfVxuXG4gIGNvbnN0IGRyYWdSZWN0ID0gZHJhZ2dhYmxlLmdldFJlY3QoZHJhZ2dhYmxlRWxlbWVudClcblxuICBpZiAoZHJhZ1JlY3QgJiYgZHJvcE92ZXJsYXAgPT09ICdjZW50ZXInKSB7XG4gICAgY29uc3QgY3ggPSBkcmFnUmVjdC5sZWZ0ICsgZHJhZ1JlY3Qud2lkdGggIC8gMlxuICAgIGNvbnN0IGN5ID0gZHJhZ1JlY3QudG9wICArIGRyYWdSZWN0LmhlaWdodCAvIDJcblxuICAgIGRyb3BwZWQgPSBjeCA+PSByZWN0LmxlZnQgJiYgY3ggPD0gcmVjdC5yaWdodCAmJiBjeSA+PSByZWN0LnRvcCAmJiBjeSA8PSByZWN0LmJvdHRvbVxuICB9XG5cbiAgaWYgKGRyYWdSZWN0ICYmIHV0aWxzLmlzLm51bWJlcihkcm9wT3ZlcmxhcCkpIHtcbiAgICBjb25zdCBvdmVybGFwQXJlYSAgPSAoTWF0aC5tYXgoMCwgTWF0aC5taW4ocmVjdC5yaWdodCwgZHJhZ1JlY3QucmlnaHQpIC0gTWF0aC5tYXgocmVjdC5sZWZ0LCBkcmFnUmVjdC5sZWZ0KSkgKlxuICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLm1heCgwLCBNYXRoLm1pbihyZWN0LmJvdHRvbSwgZHJhZ1JlY3QuYm90dG9tKSAtIE1hdGgubWF4KHJlY3QudG9wLCBkcmFnUmVjdC50b3ApKSlcblxuICAgIGNvbnN0IG92ZXJsYXBSYXRpbyA9IG92ZXJsYXBBcmVhIC8gKGRyYWdSZWN0LndpZHRoICogZHJhZ1JlY3QuaGVpZ2h0KVxuXG4gICAgZHJvcHBlZCA9IG92ZXJsYXBSYXRpbyA+PSBkcm9wT3ZlcmxhcFxuICB9XG5cbiAgaWYgKGludGVyYWN0YWJsZS5vcHRpb25zLmRyb3AuY2hlY2tlcikge1xuICAgIGRyb3BwZWQgPSBpbnRlcmFjdGFibGUub3B0aW9ucy5kcm9wLmNoZWNrZXIoZHJhZ0V2ZW50LCBldmVudCwgZHJvcHBlZCwgaW50ZXJhY3RhYmxlLCBkcm9wRWxlbWVudCwgZHJhZ2dhYmxlLCBkcmFnZ2FibGVFbGVtZW50KVxuICB9XG5cbiAgcmV0dXJuIGRyb3BwZWRcbn1cblxuY29uc3QgZHJvcCA9IHtcbiAgaW5zdGFsbCxcbiAgZ2V0QWN0aXZlRHJvcHMsXG4gIGdldERyb3AsXG4gIGdldERyb3BFdmVudHMsXG4gIGZpcmVEcm9wRXZlbnRzLFxuICBkZWZhdWx0czoge1xuICAgIGVuYWJsZWQ6IGZhbHNlLFxuICAgIGFjY2VwdCA6IG51bGwsXG4gICAgb3ZlcmxhcDogJ3BvaW50ZXInLFxuICB9IGFzIEludGVyYWN0LkRyb3B6b25lT3B0aW9ucyxcbn1cblxuZXhwb3J0IGRlZmF1bHQgZHJvcFxuIl19