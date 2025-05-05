"use client";

import React from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";

// Map container style
const containerStyle = {
  width: "100%",
  height: "300px",
};

// Custom map style preserving city/country labels
const cleanMapStyle: google.maps.MapTypeStyle[] = [
  {
    featureType: "administrative.country",
    elementType: "labels.text",
    stylers: [{ visibility: "on" }],
  },
  {
    featureType: "administrative.locality",
    elementType: "labels.text",
    stylers: [{ visibility: "on" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "transit",
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "road",
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "water",
    stylers: [{ color: "#aadaff" }],
  },
  {
    featureType: "landscape",
    stylers: [{ color: "#f2f2f2" }],
  },
  {
    featureType: "poi.park",
    stylers: [{ color: "#c5f5c5" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
];

const GoogleMapView: React.FC = () => {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  });

  const center = {
    lat: 50.798526763916016,
    lng: 6.879726409912109,
  };

  if (!isLoaded) return <div>Loading map…</div>;

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={10}
      options={{
        styles: cleanMapStyle,
        disableDefaultUI: true,
        fullscreenControl: true,
        zoomControl: false,
        gestureHandling: "cooperative",
      }}
    >
      <Marker position={center} />
    </GoogleMap>
  );
};

export default GoogleMapView;
