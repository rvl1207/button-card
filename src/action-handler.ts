import { directive, PropertyPart } from 'lit-html';
// import '@material/mwc-ripple';
// tslint:disable-next-line
import { Ripple } from '@material/mwc-ripple';
import { myFireEvent } from './my-fire-event';

const isTouch = 'ontouchstart' in window ||
  navigator.maxTouchPoints > 0 ||
  navigator.msMaxTouchPoints > 0;

interface ActionHandler extends HTMLElement {
  holdTime: number;
  bind(element: Element, options): void;
}
interface ActionHandlerElement extends HTMLElement {
  actionHandler?: boolean;
}

declare global {
  interface HASSDomEvents {
    action: ActionHandlerDetail;
  }
}

interface ActionHandlerOptions {
  hasHold?: boolean;
  hasDoubleClick?: boolean;
  repeat?: Number;
}

interface ActionHandlerDetail {
  action: string;
}

class ActionHandler extends HTMLElement implements ActionHandler {
  public holdTime = 500;

  public ripple: Ripple;

  protected timer?: number;

  protected held = false;

  private dblClickTimeout?: number;

  private repeatTimeout: NodeJS.Timeout | undefined;

  private isRepeating: boolean = false;

  constructor() {
    super();
    this.ripple = document.createElement('mwc-ripple');
  }

  public connectedCallback() {
    Object.assign(this.style, {
      position: 'absolute',
      width: isTouch ? '100px' : '50px',
      height: isTouch ? '100px' : '50px',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
    });

    this.appendChild(this.ripple);
    this.ripple.primary = true;

    [
      'touchcancel',
      'mouseout',
      'mouseup',
      'touchmove',
      'mousewheel',
      'wheel',
      'scroll',
    ].forEach((ev) => {
      document.addEventListener(
        ev,
        () => {
          clearTimeout(this.timer);
          this.stopAnimation();
          this.timer = undefined;
        },
        { passive: true }
      );
    });
  }

  public bind(element: ActionHandlerElement, options) {
    if (element.actionHandler) {
      return;
    }
    element.actionHandler = true;

    element.addEventListener('contextmenu', (ev: Event) => {
      const e = ev || window.event;
      if (e.preventDefault) {
        e.preventDefault();
      }
      if (e.stopPropagation) {
        e.stopPropagation();
      }
      e.cancelBubble = true;
      e.returnValue = false;
      return false;
    });

    const start = (ev: Event) => {
      this.held = false;
      let x;
      let y;
      if ((ev as TouchEvent).touches) {
        x = (ev as TouchEvent).touches[0].pageX;
        y = (ev as TouchEvent).touches[0].pageY;
      } else {
        x = (ev as MouseEvent).pageX;
        y = (ev as MouseEvent).pageY;
      }

      this.timer = window.setTimeout(() => {
        this.startAnimation(x, y);
        this.held = true;
        if (options.repeat && !this.isRepeating) {
          this.isRepeating = true;
          this.repeatTimeout = setInterval(() => {
            myFireEvent(element, 'action', { action: 'hold' });
          }, options.repeat)
        }
      }, this.holdTime);
    };

    const handleEnter = (ev: KeyboardEvent) => {
      if (ev.keyCode !== 13) {
        return;
      }
      end(ev);
    };

    const end = (ev: Event) => {
      // Prevent mouse event if touch event
      ev.preventDefault();
      if (
        ['touchend', 'touchcancel'].includes(ev.type) &&
        this.timer === undefined
      ) {
        if (this.isRepeating && this.repeatTimeout) {
          clearInterval(this.repeatTimeout);
          this.isRepeating = false;
        }
        return;
      }
      clearTimeout(this.timer);
      if (this.isRepeating && this.repeatTimeout) {
        clearInterval(this.repeatTimeout);
      }
      this.isRepeating = false;
      this.stopAnimation();
      this.timer = undefined;
      if (this.held) {
        if (!options.repeat) {
          myFireEvent(element, 'action', { action: 'hold' });
        }
      } else if (options.hasDoubleClick) {
        if (
          (ev.type === 'click' && (ev as MouseEvent).detail < 2) ||
          !this.dblClickTimeout
        ) {
          this.dblClickTimeout = window.setTimeout(() => {
            this.dblClickTimeout = undefined;
            myFireEvent(element, 'action', { action: 'tap' });
          }, 250);
        } else {
          clearTimeout(this.dblClickTimeout);
          this.dblClickTimeout = undefined;
          myFireEvent(element, 'action', { action: 'double_tap' });
        }
      } else {
        myFireEvent(element, 'action', { action: 'tap' });
      }
    };

    element.addEventListener('touchstart', start, { passive: true });
    element.addEventListener('touchend', end);
    element.addEventListener('touchcancel', end);

    element.addEventListener('mousedown', start, { passive: true });
    element.addEventListener('click', end);

    element.addEventListener('keyup', handleEnter);
  }

  private startAnimation(x: number, y: number) {
    Object.assign(this.style, {
      left: `${x}px`,
      top: `${y}px`,
      display: null,
    });
    this.ripple.disabled = false;
    this.ripple.active = true;
    this.ripple.unbounded = true;
  }

  private stopAnimation() {
    this.ripple.active = false;
    this.ripple.disabled = true;
    this.style.display = 'none';
  }
}

customElements.define('button-card-action-handler', ActionHandler);

const getActionHandler = (): ActionHandler => {
  const body = document.body;
  if (body.querySelector('button-card-action-handler')) {
    return body.querySelector('button-card-action-handler') as ActionHandler;
  }

  const actionhandler = document.createElement('button-card-action-handler');
  body.appendChild(actionhandler);

  return actionhandler as ActionHandler;
};

export const actionHandlerBind = (
  element: ActionHandlerElement,
  options: ActionHandlerOptions,
) => {
  const actionhandler: ActionHandler = getActionHandler();
  if (!actionhandler) {
    return;
  }
  actionhandler.bind(element, options);
};

export const actionHandler = directive(
  (options: ActionHandlerOptions = {}) => (part: PropertyPart) => {
    actionHandlerBind(part.committer.element as ActionHandlerElement, options);
  }
);
