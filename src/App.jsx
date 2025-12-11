import React, { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import bbox from '@turf/bbox';
import 'maplibre-gl/dist/maplibre-gl.css';

function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);

  useEffect(() => {
    if (map.current) return;

    // GREYSCALE STYLE (CartoDB Positron)
    const greyStyle = {
      version: 8,
      sources: {
        'carto-light': {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
            'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
            'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
          ],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap &copy; CARTO'
        }
      },
      layers: [
        {
          id: 'carto-light-layer',
          type: 'raster',
          source: 'carto-light',
          minzoom: 0,
          maxzoom: 22
        }
      ]
    };

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: greyStyle,
      center: [0, 20],
      zoom: 2
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.current.on('load', async () => {
      console.log("Map loaded, fetching OAM data...");

      try {
        // === SMART URL SELECTOR ===
        // If we are developing locally (npm run dev), use the '/api' tunnel.
        // If we are live on GitHub Pages, use the real OAM URL directly.
        const API_BASE = import.meta.env.DEV 
          ? '/api' 
          : 'https://api.openaerialmap.org';

        const response = await fetch(`${API_BASE}/meta?limit=100&order_by=_id&sort=desc`);
        const data = await response.json();

        if (!data.results || data.results.length === 0) {
          console.warn("No images found!");
          return;
        }

        const features = data.results.map(image => ({
          type: 'Feature',
          geometry: image.geojson,
          properties: {
            id: image._id,
            title: image.title,
            provider: image.provider,
            platform: image.platform,
            thumbnail: image.properties && image.properties.thumbnail ? image.properties.thumbnail : null,
            date: image.acquisition_end ? new Date(image.acquisition_end).toLocaleDateString() : 'Unknown Date'
          }
        }));

        const geojson = { type: 'FeatureCollection', features: features };

        map.current.addSource('oam-imagery', {
          type: 'geojson',
          data: geojson
        });

        // LAYER 1: Fill (Clickable Target)
        map.current.addLayer({
          id: 'oam-footprints-fill',
          type: 'fill',
          source: 'oam-imagery',
          layout: {},
          paint: {
            'fill-color': '#00E5FF', 
            'fill-opacity': 0.15,    
            'fill-outline-color': 'rgba(0,0,0,0)'
          }
        });

        // LAYER 2: Outline
        map.current.addLayer({
          id: 'oam-footprints-line',
          type: 'line',
          source: 'oam-imagery',
          layout: {},
          paint: {
            'line-color': '#00B0FF',
            'line-width': 2,
            'line-opacity': 0.9
          }
        });

        // === INTERACTIVITY ===
        
        map.current.on('mouseenter', 'oam-footprints-fill', () => {
          map.current.getCanvas().style.cursor = 'pointer';
        });
        map.current.on('mouseleave', 'oam-footprints-fill', () => {
          map.current.getCanvas().style.cursor = '';
        });

        map.current.on('click', 'oam-footprints-fill', (e) => {
          const props = e.features[0].properties;
          const coordinates = e.lngLat;

          const htmlContent = `
            <div style="font-family: sans-serif; min-width: 200px;">
              <h3 style="font-weight: bold; margin-bottom: 5px; font-size: 14px;">${props.title || 'Untitled Image'}</h3>
              <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
                ${props.date} • ${props.provider}
              </div>
              ${props.thumbnail ? `<img src="${props.thumbnail}" style="width: 100%; height: auto; border-radius: 4px; display: block;" />` : ''}
              <div style="margin-top: 8px; font-size: 11px; color: #999;">ID: ${props.id}</div>
            </div>
          `;

          new maplibregl.Popup({ closeButton: false, maxWidth: '300px' })
            .setLngLat(coordinates)
            .setHTML(htmlContent)
            .addTo(map.current);
        });

        // AUTO-ZOOM
        const bounds = bbox(geojson);
        map.current.fitBounds(bounds, { padding: 80, maxZoom: 14 });

      } catch (error) {
        console.error("Failed to fetch OAM data:", error);
      }
    });
  }, []);

  return (
    <div className="relative w-full h-full">
      {/* Floating UI Card */}
      <div className="absolute top-0 left-0 z-10 p-5 m-5 bg-white rounded-lg shadow-xl w-80 font-sans border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">OAM Next</h1>
        <p className="text-sm text-gray-600 mb-4">
          Latest 100 uploads (Real-time Feed)
        </p>
        
        <div className="flex items-center space-x-2">
           <span className="w-3 h-3 bg-cyan-500 rounded-full inline-block"></span>
           <span className="text-sm font-medium text-gray-500">Live API Data</span>
        </div>
        <div className="mt-4 text-xs text-gray-400 border-t pt-2">
          Click any footprint to see details.
        </div>
      </div>

      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}

export default App;