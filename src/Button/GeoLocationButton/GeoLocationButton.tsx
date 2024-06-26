import * as React from 'react';

import OlMap from 'ol/Map';
import OlGeolocation from 'ol/Geolocation';
import OlGeomLineString from 'ol/geom/LineString';
import OlFeature from 'ol/Feature';
import OlGeomPoint from 'ol/geom/Point';
import OlLayerVector from 'ol/layer/Vector';
import OlSourceVector from 'ol/source/Vector';
import OlStyleStyle from 'ol/style/Style';
import OlStyleIcon from 'ol/style/Icon';
import OlGeometry from 'ol/geom/Geometry';
import OlGeometryLayout from 'ol/geom/GeometryLayout';

import ToggleButton, { ToggleButtonProps } from '../ToggleButton/ToggleButton';

import MapUtil from '@terrestris/ol-util/dist/MapUtil/MapUtil';
import MathUtil from '@terrestris/base-util/dist/MathUtil/MathUtil';

import { CSS_PREFIX } from '../../constants';

import mapMarker from './geolocation-marker.png';
import mapMarkerHeading from './geolocation-marker-heading.png';

interface DefaultProps {
  /**
   * Will be called if geolocation fails.
   */
  onError: (error: any) => void;
  /**
   * Will be called when position changes. Receives an object with the properties
   * position, accuracy, heading and speed
   */
  onGeolocationChange: (geolocation: any) => void;
  /**
   * Whether to show a map marker at the current position.
   */
  showMarker: boolean;
  /**
   * Whether to follow the current position.
   */
  follow: boolean;
  /**
   * The openlayers tracking options. See also
   * https://www.w3.org/TR/geolocation-API/#position_options_interface
   */
  trackingOptions: {
    maximumAge: number;
    enableHighAccuracy: boolean;
    timeout: number;
  };
}

interface BaseProps {
  /**
   * The className which should be added.
   */
  className?: string;
  /**
   * Instance of OL map this component is bound to.
   */
  map: OlMap;
  /**
   * Will be called if geolocation fails.
   */
  onError: (error: any) => void;
  /**
   * Will be called when position changes. Receives an object with the properties
   * position, accuracy, heading and speed
   */
  onGeolocationChange: (geolocation: any) => void;
  /**
   * Whether to show a map marker at the current position.
   */
  showMarker: boolean;
  /**
   * Whether to follow the current position.
   */
  follow: boolean;
  /**
   * The openlayers tracking options. See also
   * https://www.w3.org/TR/geolocation-API/#position_options_interface
   */
  trackingOptions: {
    maximumAge: number;
    enableHighAccuracy: boolean;
    timeout: number;
  };
}

export type GeoLocationButtonProps = BaseProps & Partial<DefaultProps> & ToggleButtonProps;

/**
 * The GeoLocationButton.
 *
 * @class The GeoLocationButton
 * @extends React.Component
 */
class GeoLocationButton extends React.Component<GeoLocationButtonProps> {

  /**
   * The default properties.
   */
  static defaultProps: DefaultProps = {
    onGeolocationChange: () => undefined,
    onError: () => undefined,
    showMarker: true,
    follow: false,
    trackingOptions: {
      maximumAge: 10000,
      enableHighAccuracy: true,
      timeout: 600000
    }
  };

  /**
   * The className added to this component.
   *
   * @private
   */
  _className = `${CSS_PREFIX}geolocationbutton`;

  /**
   * The feature marking the current location.
   */
  _markerFeature = undefined;

  /**
   * The OpenLayers geolocation interaction.
   */
  _geoLocationInteraction = undefined;

  /**
   * The layer containing the markerFeature.
   */
  _geoLocationLayer = new OlLayerVector({
    properties: {
      name: 'react-geo_geolocationlayer',
    },
    source: new OlSourceVector()
  });

  _positions: OlGeomLineString;

  /**
   * Creates the MeasureButton.
   *
   * @constructs MeasureButton
   */
  constructor(props: BaseProps) {
    super(props);
    const {
      map,
      showMarker
    } = this.props;
    const allLayers = MapUtil.getAllLayers(map);

    this._positions = new OlGeomLineString([], OlGeometryLayout.XYZM);
    this._geoLocationLayer.setStyle(this._styleFunction);
    if (!allLayers.includes(this._geoLocationLayer)) {
      map.addLayer(this._geoLocationLayer);
    }
    this.state = {};

    if (showMarker) {
      this._markerFeature = new OlFeature();
      this._geoLocationLayer.getSource().addFeature(this._markerFeature);
    }
  }

  /**
   * Adds the markerFeature if not already done and adds it to the geoLocation
   * layer.
   */
  componentDidUpdate() {
    const {
      showMarker
    } = this.props;

    if (showMarker && !this._markerFeature) {
      this._markerFeature = new OlFeature();
      this._geoLocationLayer.getSource().addFeature(this._markerFeature);
    }
  }

  /**
   * The styleFunction for the geoLocationLayer. Shows a marker with arrow when
   * heading is not 0.
   */
  _styleFunction = (feature: OlFeature<OlGeometry>) => {
    const heading = feature.get('heading');
    const src = heading !== 0 ? mapMarkerHeading : mapMarker;
    const rotation = heading !== 0 ? heading * Math.PI / 180 : 0;

    return [new OlStyleStyle({
      image: new OlStyleIcon({
        rotation,
        src
      })
    })];
  };

  /**
   * Callback of the interactions on change event.
   */
  onGeolocationChange = () => {
    const position = this._geoLocationInteraction.getPosition();
    const accuracy = this._geoLocationInteraction.getAccuracy();
    let heading = this._geoLocationInteraction.getHeading() || 0;
    const speed = this._geoLocationInteraction.getSpeed() || 0;

    const x = position[0];
    const y = position[1];
    const fCoords = this._positions.getCoordinates();
    const previous = fCoords[fCoords.length - 1];
    const prevHeading = previous && previous[2];
    if (prevHeading) {
      let headingDiff = heading - MathUtil.mod(prevHeading);

      // force the rotation change to be less than 180°
      if (Math.abs(headingDiff) > Math.PI) {
        const sign = (headingDiff >= 0) ? 1 : -1;
        headingDiff = -sign * (2 * Math.PI - Math.abs(headingDiff));
      }
      heading = prevHeading + headingDiff;
    }
    this._positions.appendCoordinate([x, y, heading, Date.now()]);

    // only keep the 20 last coordinates
    this._positions.setCoordinates(this._positions.getCoordinates().slice(-20));

    this.updateView();

    this.props.onGeolocationChange({
      position,
      accuracy,
      heading,
      speed
    });
  };

  onGeolocationError = (error: any) => {
    this.props.onError(error);
  };

  /**
   * Called when the button is toggled, this method ensures that everything
   * is cleaned up when unpressed, and that geolocating can start when pressed.
   *
   * @method
   */
  onToggle = (pressed: boolean) => {
    const {
      showMarker,
      trackingOptions,
      map
    } = this.props;

    const view = map.getView();

    if (!pressed) {
      if (this._geoLocationInteraction) {
        this._geoLocationInteraction.un('change', this.onGeolocationChange);
        this._geoLocationInteraction = null;
      }
      if (this._markerFeature) {
        this._markerFeature = undefined;
        this._geoLocationLayer.getSource().clear();
      }
      return;
    }

    // Geolocation Control
    this._geoLocationInteraction = new OlGeolocation({
      projection: view.getProjection(),
      trackingOptions: trackingOptions
    });
    this._geoLocationInteraction.setTracking(true);

    if (showMarker) {
      if (!this._markerFeature) {
        this._markerFeature = new OlFeature();
      }
      if (!this._geoLocationLayer.getSource().getFeatures().includes(this._markerFeature)) {
        this._geoLocationLayer.getSource().addFeature(this._markerFeature);
      }
      const heading = this._geoLocationInteraction.getHeading() || 0;
      const speed = this._geoLocationInteraction.getSpeed() || 0;
      this._markerFeature.set('speed', speed);
      this._markerFeature.set('heading', heading);
    }

    // add listeners
    this._geoLocationInteraction.on('change', this.onGeolocationChange);
    this._geoLocationInteraction.on('error', this.onGeolocationError);
  };

  // recenters the view by putting the given coordinates at 3/4 from the top or
  // the screen
  getCenterWithHeading = (position, rotation, resolution) => {
    const size = this.props.map.getSize();
    const height = size[1];

    return [
      position[0] - Math.sin(rotation) * height * resolution * 1 / 4,
      position[1] + Math.cos(rotation) * height * resolution * 1 / 4
    ];
  };

  updateView = () => {
    const view = this.props.map.getView();
    const deltaMean = 500; // the geolocation sampling period mean in ms
    let previousM = 0;
    // use sampling period to get a smooth transition
    let m = Date.now() - deltaMean * 1.5;
    m = Math.max(m, previousM);

    previousM = m;
    // interpolate position along positions LineString
    const c = this._positions.getCoordinateAtM(m, true);
    if (c) {
      if (this.props.follow) {
        view.setCenter(this.getCenterWithHeading(c, -c[2], view.getResolution()));
        view.setRotation(-c[2]);
      }
      if (this.props.showMarker) {
        const pointGeometry = new OlGeomPoint([c[0], c[1]]);
        this._markerFeature.setGeometry(pointGeometry);
      }
    }
  };

  /**
   * The render function.
   */
  render() {
    const {
      className,
      map,
      showMarker,
      follow,
      onGeolocationChange,
      onError,
      trackingOptions,
      ...passThroughProps
    } = this.props;

    const finalClassName = className
      ? `${className} ${this._className}`
      : this._className;

    return (
      <ToggleButton
        onToggle={this.onToggle}
        className={finalClassName}
        {...passThroughProps}
      />
    );
  }
}

export default GeoLocationButton;
