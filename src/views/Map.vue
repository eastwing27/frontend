<template>
  <LMap
    ref="map"
    :center="map.center"
    :zoom="map.zoom"
    :options="{ zoomControl: false }"
    @update:center="setMapCenter"
    @update:zoom="setMapZoom"
  >
    <LControlZoom
      v-if="controls.zoom.display"
      :position="controls.zoom.position"
    />
    <LControlScale
      v-if="controls.scale.display"
      :position="controls.scale.position"
      :max-width="controls.scale.maxWidth"
      :metric="controls.scale.metric"
      :imperial="controls.scale.imperial"
    />
    <LTileLayer
      :url="url"
      :attribution="attribution"
      :tile-size="tileSize"
      :options="{ maxNativeZoom, maxZoom, zoomOffset }"
    />

    <template v-if="map.layers.line">
      <LPolyline
        v-for="(group, i) in filteredLocationHistoryLatLngGroups"
        :key="i"
        :lat-lngs="group.latLngs"
        v-bind="polyline"
        :color="map.showUserColors ? getUserColor(group.user) : polyline.color"
        class-name="ot-track-line"
      />
    </template>

    <template v-for="(userDevices, user) in filteredLocationHistory">
      <template v-for="(deviceLocations, device) in userDevices">
        <template
          v-for="(l, n) in deviceLocationsWithNameAndFace(
            user,
            device,
            deviceLocations
          )"
        >
          <LCircleMarker
            v-if="map.layers.poi && l.poi"
            :key="`${l.topic}-poi-${n}`"
            :lat-lng="[l.lat, l.lon]"
            v-bind="poiMarker"
          >
            <LTooltip :options="{ permanent: true }">
              {{ l.poi }}
            </LTooltip>
          </LCircleMarker>
          <LMarker
            v-if="map.layers.points"
            :key="`${l.topic}-location-${n}`"
            :lat-lng="[l.lat, l.lon]"
            :icon="
              trackArrowIcon(
                l.bearing,
                map.showUserColors ? getUserColor(user) : circleMarker.color
              )
            "
          >
            <LDeviceLocationPopup
              :user="user"
              :device="device"
              :name="l.name"
              :face="l.face"
              :timestamp="l.tst"
              :iso-local="l.isolocal"
              :time-zone="l.tzname"
              :lat="l.lat"
              :lon="l.lon"
              :alt="l.alt"
              :battery="l.batt"
              :speed="l.vel"
              :regions="l.inregions"
              :wifi="{ ssid: l.SSID, bssid: l.BSSID }"
              :address="l.addr"
            ></LDeviceLocationPopup>
          </LMarker>
        </template>
      </template>
    </template>

    <template v-if="map.layers.last">
      <LCircle
        v-for="l in lastLocations"
        :key="`${l.topic}-circle`"
        :lat-lng="[l.lat, l.lon]"
        :radius="l.acc"
        v-bind="circle"
      />

      <LMarker
        v-for="l in lastLocations"
        :key="`${l.topic}-marker`"
        :lat-lng="[l.lat, l.lon]"
        :icon="markerIcon"
      >
        <LDeviceLocationPopup
          :user="l.username"
          :device="l.device"
          :name="l.name"
          :face="l.face"
          :timestamp="l.tst"
          :iso-local="l.isolocal"
          :time-zone="l.tzname"
          :lat="l.lat"
          :lon="l.lon"
          :alt="l.alt"
          :battery="l.batt"
          :speed="l.vel"
          :regions="l.inregions"
          :wifi="{ ssid: l.SSID, bssid: l.BSSID }"
          :options="{ className: 'leaflet-popup--for-pin', maxWidth: 400 }"
          :address="l.addr"
        />
      </LMarker>
    </template>

    <template v-if="map.layers.heatmap">
      <LHeatmap
        v-if="filteredLocationHistoryLatLngs.length"
        :lat-lng="filteredLocationHistoryLatLngs"
        :max="heatmap.max"
        :radius="heatmap.radius"
        :blur="heatmap.blur"
        :gradient="heatmap.gradient"
      />
    </template>
  </LMap>
</template>

<script>
import { mapGetters, mapState, mapMutations } from "vuex";
import L from "leaflet";
import {
  LMap,
  LTileLayer,
  LControlScale,
  LControlZoom,
  LMarker,
  LCircleMarker,
  LCircle,
  LPolyline,
  LTooltip,
} from "vue2-leaflet";
import "leaflet/dist/leaflet.css";
import * as types from "@/store/mutation-types";
import LCustomMarker from "@/components/LCustomMarker";
import trackArrowIcon from "@/components/LTrackArrowIcon";
import LHeatmap from "@/components/LHeatmap.vue";
import LDeviceLocationPopup from "@/components/LDeviceLocationPopup.vue";
import { bearingBetweenCoordinates, colorForIndex } from "@/util";

export default {
  components: {
    LMap,
    LTileLayer,
    LControlScale,
    LControlZoom,
    LMarker,
    LCircleMarker,
    LCircle,
    LPolyline,
    LDeviceLocationPopup,
    LHeatmap,
    LTooltip,
  },
  data() {
    return {
      attribution: this.$config.map.attribution,
      center: this.$store.state.map.center,
      controls: this.$config.map.controls,
      heatmap: this.$config.map.heatmap,
      markerIcon: LCustomMarker,
      maxZoom: this.$config.map.maxZoom,
      maxNativeZoom: this.$config.map.maxNativeZoom,
      tileSize: this.$config.map.tileSize,
      url: this.$config.map.url,
      zoom: this.$store.state.map.zoom,
      zoomOffset: this.$config.map.zoomOffset,
      circle: {
        ...this.$config.map.circle,
        color: this.$config.map.circle.color || this.$config.primaryColor,
        fillColor:
          this.$config.map.circle.fillColor || this.$config.primaryColor,
      },
      circleMarker: {
        ...this.$config.map.circleMarker,
        color: this.$config.map.circleMarker.color || this.$config.primaryColor,
      },
      poiMarker: this.$config.map.poiMarker,
      polyline: {
        ...this.$config.map.polyline,
        color: this.$config.map.polyline.color || this.$config.primaryColor,
      },
      userColorMap: {},
      // Randomized once per page load, so the palette differs between
      // reloads while staying stable (and evenly spaced) within a session.
      colorBaseHue: Math.floor(Math.random() * 360),
    };
  },
  computed: {
    ...mapGetters([
      "filteredLocationHistory",
      "filteredLocationHistoryLatLngs",
      "filteredLocationHistoryLatLngGroups",
    ]),
    ...mapState(["lastLocations", "map"]),
  },
  watch: {
    lastLocations() {
      if (this.$config.onLocationChange.fitView) {
        this.fitView();
      }
    },
    filteredLocationHistory() {
      this.fitView();
    },
  },
  mounted() {
    this.$root.$on("fitView", () => {
      this.fitView();
    });
  },
  methods: {
    ...mapMutations({
      setMapCenter: types.SET_MAP_CENTER,
      setMapZoom: types.SET_MAP_ZOOM,
    }),
    /**
     * Fit all objects on the map into view.
     */
    fitView() {
      if (
        (this.map.layers.line ||
          this.map.layers.points ||
          this.map.layers.poi ||
          this.map.layers.heatmap) &&
        this.filteredLocationHistoryLatLngs.length > 0
      ) {
        this.$refs.map.mapObject.fitBounds(
          new L.LatLngBounds(this.filteredLocationHistoryLatLngs)
        );
      } else if (this.map.layers.last && this.lastLocations.length > 0) {
        const locations = this.lastLocations.map((l) => L.latLng(l.lat, l.lon));
        this.$refs.map.mapObject.fitBounds(new L.LatLngBounds(locations), {
          maxZoom: this.maxNativeZoom,
        });
      }
    },
    /**
     * Find a the last location object for a user/device combination from the
     * local cache and backfill name and face attributes to each item from the
     * passed array of location objects. Also compute the bearing (direction
     * of movement) of each point towards the next point in time, falling
     * back to the bearing from the previous point for the last one.
     *
     * @param {User} user Username
     * @param {Device} device Device name
     * @param {OTLocation[]} deviceLocations Device name
     * @returns {OTLocation[]} Updated locations
     */
    deviceLocationsWithNameAndFace(user, device, deviceLocations) {
      const lastLocation = this.lastLocations.find(
        (l) => l.username === user && l.device === device
      );
      return deviceLocations.map((l, i) => {
        const next = deviceLocations[i + 1];
        const previous = deviceLocations[i - 1];
        let bearing = 0;
        if (next) {
          bearing = bearingBetweenCoordinates(
            L.latLng(l.lat, l.lon),
            L.latLng(next.lat, next.lon)
          );
        } else if (previous) {
          bearing = bearingBetweenCoordinates(
            L.latLng(previous.lat, previous.lon),
            L.latLng(l.lat, l.lon)
          );
        }
        return {
          ...l,
          name: lastLocation ? lastLocation.name : l.name,
          face: lastLocation ? lastLocation.face : l.face,
          bearing,
        };
      });
    },
    /**
     * Get a random color for a user, generating and caching a new one the
     * first time it's requested. Stable for the lifetime of the page, but
     * re-randomized on every reload.
     *
     * @param {User} user Username
     * @returns {String} CSS color
     */
    getUserColor(user) {
      if (!this.userColorMap[user]) {
        const index = Object.keys(this.userColorMap).length;
        this.$set(
          this.userColorMap,
          user,
          colorForIndex(index, this.colorBaseHue)
        );
      }
      return this.userColorMap[user];
    },
    /**
     * Build a divIcon for a location history point, shaped as an arrow
     * rotated towards its direction of movement.
     *
     * @param {Number} bearing Bearing in degrees, where 0 is north
     * @param {String} color CSS color for the arrow
     * @returns {L.DivIcon} Leaflet icon
     */
    trackArrowIcon(bearing, color) {
      return trackArrowIcon(bearing, color, this.circleMarker.radius * 3);
    },
  },
};
</script>

<style>
/*
 * Leaflet renders polylines as SVG elements outside of Vue's control, so
 * this can't be a scoped style. The stacked drop-shadows fake a dark halo
 * around the track line, keeping it legible against any tile background
 * regardless of the line's own color.
 */
.ot-track-line {
  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.8))
    drop-shadow(0 0 1px rgba(0, 0, 0, 0.8));
}
</style>
