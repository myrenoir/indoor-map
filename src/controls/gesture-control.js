import { addEvent, removeEvent } from '../utils/event'
import { Vector2, Vector3, Matrix4, Plane, Raycaster, EventDispatcher } from '../libs/threejs/three.module'

const STATE = {
    NONE: -1,
    ROTATE: 0,
    ZOOM: 1,
    PAN: 2,
    CLICK: 3,
    TOUCH_ROTATE: 5,
    TOUCH_ZOOM_PAN: 6,
}
const userRotateSpeed = 2.0
const autoRotateSpeed = 1.0
const autoRotationAngle = ((2 * Math.PI) / 60 / 60) * autoRotateSpeed
const PIXELS_PER_ROUND = 1800
const SCALE_STEP = 1.05
const TOUCH_SCALE_STEP = 1.03

class GestureControl {
    constructor(map) {
        this.$map = map
        this.camera = map._camera
        this.wrapper = map.$mapWrapper

        this.enabled = true
        this.scrollWheelZoomEnabled = true
        this.viewChanged = true

        this.onClickListener = null

        this.onHoverListener = null
        this.is3dMode = true

        this._initListeners()
        this._initVars()
    }

    destroy() {
        this._initListeners(true)
    }

    reset() {
        this._initVars()
    }

    pan(start, end) {
        let vector = this.viewToWorld(start).sub(this.viewToWorld(end))

        this.$map._translate_(vector)
    }

    rotateLeft(angle = autoRotationAngle) {
        this.$map.rotateTo({ angle: this.$map.rotateAngle - angle })
    }

    rotateRight(angle = autoRotationAngle) {
        this.$map.rotateTo({ angle: this.$map.rotateAngle + angle })
    }

    rotateUp(angle = autoRotationAngle) {
        this.$map.tiltTo({ angle: this.$map.tiltAngle - angle })
    }

    rotateDown(angle = autoRotationAngle) {
        this.$map.tiltTo({ angle: this.$map.tiltAngle + angle })
    }

    _initVars() {
        this.startPosition = new Vector2()
        this.endPosition = new Vector2()
        this.deltaVector = new Vector2()
        this.touchStartPoints = [new Vector2(), new Vector2(), new Vector2()]
        this.touchEndPoints = [new Vector2(), new Vector2(), new Vector2()]

        this.cameraInverseMatrix = new Matrix4()

        this.phiDelta = 0
        this.thetaDelta = 0
        this.scale = 1
        this.currentScale = 1

        this.state = STATE.NONE

        this.lastPosition = new Vector3()

        this.center = new Vector3()
    }

    _initListeners(remove) {
        let eventType = remove ? removeEvent : addEvent
        eventType(this.wrapper, 'touchstart', this, {
            passive: false,
        })
        eventType(this.wrapper, 'mousedown', this, {
            passive: false,
        })
        eventType(window, 'touchend', this, {
            passive: false,
        })
        eventType(window, 'mouseup', this, {
            passive: false,
        })
        eventType(window, 'touchmove', this, {
            passive: false,
        })
        eventType(window, 'mousemove', this)
        eventType(this.wrapper.parentElement, 'mousewheel', this)
        eventType(window, 'contextmenu', this, false)
    }

    handleEvent(e) {
        switch (e.type) {
            case 'touchstart':
            case 'mousedown':
                if (e.touches && e.touches.length > 1) {
                    this._touchStart(e)
                } else {
                    this._start(e)
                }
                break
            case 'touchmove':
            case 'mousemove':
                if (e.touches && e.touches.length > 1 && (this.state === STATE.ZOOM || this.state === STATE.ROTATE)) {
                    this._touchMove(e)
                } else {
                    this._move(e)
                }
                break
            case 'mouseout':
                this.state = STATE.NONE
                break
            case 'touchend':
            case 'mouseup':
                this._end(e)
                break
            case 'mousewheel':
                this._wheel(e)
                break
            case 'contextmenu':
                e.preventDefault()
                break
        }
        e.preventDefault()
    }

    _start(e) {
        if (!this.enabled) return

        if (this.state === STATE.NONE) {
            if (e.button === 0 || (e.touches && e.touches.length == 1)) {
                this.state = STATE.CLICK
            } else if (e.button === 1) {
                this.state = STATE.ZOOM
            } else if (e.button === 2) {
                this.state = STATE.ROTATE
            }
        }

        const point = e.touches ? e.touches[0] : e

        this.startPosition.set(point.pageX, point.pageY)
    }

    _move(e) {
        if (!this.enabled) return
        if (this.state !== STATE.NONE) {
            // e.preventDefault()
            const point = e.touches ? e.touches[0] : e

            this.endPosition.set(point.pageX, point.pageY)
            this.deltaVector.subVectors(this.endPosition, this.startPosition)
            if (this.deltaVector.length() == 0) {
                return
            }
            if (this.state === STATE.ROTATE) {
                this.rotateLeft(((2 * Math.PI * this.deltaVector.x) / PIXELS_PER_ROUND) * userRotateSpeed)
                this.rotateUp(((2 * Math.PI * this.deltaVector.y) / PIXELS_PER_ROUND) * userRotateSpeed)
            } else if (this.state === STATE.ZOOM) {
                if (this.deltaVector.y > 0) {
                    this.$map.zoomIn()
                } else {
                    this.$map.zoomOut()
                }
            } else if (this.state === STATE.CLICK || this.state === STATE.PAN) {
                this.state = STATE.PAN
                this.pan(this.startPosition, this.endPosition)
            }
            this.startPosition.copy(this.endPosition)
        } else if (this.onHoverListener && this.wrapper.contains(e.target)) {
            this.onHoverListener(e)
        }
    }

    _end(e) {
        if (!this.enabled) return
        if (this.state === STATE.NONE) return
        let state = this.state
        this.state = STATE.NONE
        if (state === STATE.CLICK && this.onClickListener) {
            this.onClickListener(e)
        }
    }

    _wheel(e) {
        if (!this.enabled) return
        if (!this.scrollWheelZoomEnabled) return

        let delta = e.wheelDelta ? e.wheelDelta / 120 : -e.detail / 3
        let scale = Math.pow(SCALE_STEP, delta)
        this.$map._scale_(scale)
    }

    _touchStart(e) {
        if (!this.enabled) return
        ;[...e.touches]
            .filter((_, i) => i < 3)
            .map(({ pageX, pageY }, index) => this.touchStartPoints[index].set(pageX, pageY))
        if (e.touches.length === 2) {
            this.state = STATE.ZOOM
            this.span.innerHTML = '_touchStart'
        } else {
            this.state = STATE.ROTATE
        }
    }

    _touchMove(e) {
        if (!this.enabled) return
        if (this.state === STATE.NONE) return
        ;[...e.touches]
            .filter((_, i) => i < 3)
            .map(({ pageX, pageY }, index) => this.touchEndPoints[index].set(pageX, pageY))
        this.span.innerHTML = '_touchMove'
        if (this.state === STATE.ZOOM) {
            let dStart = this.touchStartPoints[1].distanceTo(this.touchStartPoints[0])
            let dEnd = this.touchEndPoints[1].distanceTo(this.touchEndPoints[0])
            if (Math.abs(dStart - dEnd) < 5) {
                return
            } else if (dStart < dEnd) {
                this.$map.zoomIn(TOUCH_SCALE_STEP)
            } else {
                this.$map.zoomOut(1 / TOUCH_SCALE_STEP)
            }
            // } else if (this.state === STATE.ROTATE) {
        }
        this.touchEndPoints.forEach((p, i) => this.touchStartPoints[i].copy(p))
    }
}

Object.assign(GestureControl.prototype, Object.create(EventDispatcher.prototype))
Object.assign(GestureControl.prototype, {
    viewToWorld: (function() {
        const raycaster = new Raycaster()
        const vector = new Vector3(0, 0, 0.5)
        const plane = new Plane(new Vector3(0, 1, 0), 0)

        return function(point) {
            vector.x = (point.x / this.wrapper.clientWidth) * 2 - 1
            vector.y = -(point.y / this.wrapper.clientHeight) * 2 + 1
            raycaster.setFromCamera(vector, this.camera)
            let result = new Vector3()
            raycaster.ray.intersectPlane(plane, result)
            return result
        }
    })(),
})

export default GestureControl