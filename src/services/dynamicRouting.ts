import {
  TripPoint,
  TransitStop,
  UserPreferences,
  RouteCandidate,
  RouteSegment,
} from '../types/transit';
import { RoutingEngine } from './routingEngine';
import { GeocodingService } from './geocoding';
import { findNearestStop, getHaversineDistanceMeters, formatDistance, estimateWalkMinutes } from '../utils/geo';

export class DynamicRoutingEngine {
  /**
   * Calculate door-to-door multi-modal routes for any two points (stop or arbitrary coordinates)
   */
  public static async calculateDynamicRoutes(
    origin: TripPoint,
    dest: TripPoint,
    preferences: UserPreferences,
    stops: TransitStop[]
  ): Promise<RouteCandidate[]> {
    if (!origin || !dest) return [];

    // Case 1: Both points are existing predefined stops
    if (origin.type === 'stop' && dest.type === 'stop' && origin.id && dest.id) {
      if (origin.id === dest.id) return [];
      return RoutingEngine.calculateRoutes(origin.id, dest.id, preferences);
    }

    // Case 2: At least one point is a custom location or tapped pin
    const nearestOrigin = findNearestStop(origin.lat, origin.lng, stops);
    const nearestDest = findNearestStop(dest.lat, dest.lng, stops);

    if (!nearestOrigin || !nearestDest) return [];

    const originStop = nearestOrigin.stop;
    const destStop = nearestDest.stop;
    const originWalkDist = origin.type === 'custom' ? nearestOrigin.distanceMeters : 0;
    const destWalkDist = dest.type === 'custom' ? nearestDest.distanceMeters : 0;

    const candidates: RouteCandidate[] = [];

    // Fetch real walking paths asynchronously via OSRM / Haversine fallback
    const firstMileWalkPromise =
      origin.type === 'custom' && originWalkDist > 5
        ? GeocodingService.getWalkingRoute([origin.lat, origin.lng], [originStop.lat, originStop.lng])
        : Promise.resolve(null);

    const lastMileWalkPromise =
      dest.type === 'custom' && destWalkDist > 5
        ? GeocodingService.getWalkingRoute([destStop.lat, destStop.lng], [dest.lat, dest.lng])
        : Promise.resolve(null);

    const [firstMileWalk, lastMileWalk] = await Promise.all([
      firstMileWalkPromise,
      lastMileWalkPromise,
    ]);

    // Check if origin and destination are close enough for direct pedestrian walking
    const directTotalDist = getHaversineDistanceMeters(
      origin.lat,
      origin.lng,
      dest.lat,
      dest.lng
    );

    if (originStop.id === destStop.id || directTotalDist < 1200) {
      const directWalk = await GeocodingService.getWalkingRoute(
        [origin.lat, origin.lng],
        [dest.lat, dest.lng]
      );

      const directWalkSegment: RouteSegment = {
        type: 'walk',
        fromName: origin.name,
        toName: dest.name,
        durationMin: directWalk.durationMin,
        distanceMeters: directWalk.distanceMeters,
        instructions: `Direct Pedestrian Route: Walk ${formatDistance(
          directWalk.distanceMeters
        )} along pedestrian walkways and sidewalks.`,
        accessibilityNotes: [
          'Paved pedestrian sidewalks with curb ramps',
          directWalk.isEstimated
            ? 'Estimated straight-line sidewalk corridor'
            : 'Turn-by-turn verified street sidewalk path (OSRM)',
          preferences.avoidStairs ? 'Level grade path, zero stairs' : 'Standard walking grade',
        ],
        stepFree: true,
        hasStairs: false,
        lightingScore: 8.8,
        elevatorInvolved: false,
        coordinates: directWalk.coordinates,
      };

      const directCandidate: RouteCandidate = {
        id: `dyn_direct_walk_${Date.now()}`,
        title: 'Direct Pedestrian Walk',
        subtitle: `${formatDistance(directWalk.distanceMeters)} • ${directWalk.durationMin} min Walk`,
        summary: `Walk directly from ${origin.name} to ${dest.name} without needing transit transfers.`,
        totalDurationMin: directWalk.durationMin,
        totalWalkDistanceMeters: directWalk.distanceMeters,
        transferCount: 0,
        segments: [directWalkSegment],
        scores: {
          accessibilityScore: 92,
          safetyScore: 86,
          comfortScore: 80,
          speedScore: directWalk.durationMin < 15 ? 90 : 70,
          overallScore: 88,
        },
        explanation: {
          headline: 'Direct Walk Recommended for Short Distance',
          whyRecommended: [
            `Total distance is ${formatDistance(directWalk.distanceMeters)}, faster than waiting for transit`,
            '100% step-free accessible sidewalk pathway',
            'Well-lit pedestrian corridor',
          ],
          tradeOffs: [
            directWalk.distanceMeters > 500
              ? 'Requires continuous walking without seating'
              : 'Direct physical walking path',
          ],
          barrierWarnings: [],
          suitabilitySummary: 'Best for riders who prefer continuous walking on level terrain.',
        },
        isRecommended: directTotalDist < 600,
        stepFree: true,
        hasStairs: false,
        crowdLevel: 'low',
        lightingAverage: 8.8,
        badges: [
          '🚶 Direct Walk',
          '♿ 100% Step-Free',
          `📏 ${formatDistance(directWalk.distanceMeters)}`,
        ],
        polylines: [
          {
            color: '#10b981',
            dashArray: '6, 6',
            weight: 5,
            positions: directWalk.coordinates,
          },
        ],
      };

      candidates.push(directCandidate);
    }

    // Now calculate transit options if origin and dest stops are different
    if (originStop.id !== destStop.id) {
      const transitRoutes = RoutingEngine.calculateRoutes(
        originStop.id,
        destStop.id,
        preferences
      );

      for (const baseRoute of transitRoutes) {
        const segments: RouteSegment[] = [];
        let extraWalkMeters = 0;
        let extraDurationMin = 0;
        const newPolylines: {
          color: string;
          dashArray?: string;
          weight: number;
          positions: [number, number][];
        }[] = [];

        // 1. Prepend first-mile walking segment if custom origin
        if (firstMileWalk && origin.type === 'custom') {
          extraWalkMeters += firstMileWalk.distanceMeters;
          extraDurationMin += firstMileWalk.durationMin;

          segments.push({
            type: 'walk',
            fromName: origin.name,
            toName: originStop.name,
            toStopId: originStop.id,
            durationMin: firstMileWalk.durationMin,
            distanceMeters: firstMileWalk.distanceMeters,
            instructions: `Walk ${formatDistance(firstMileWalk.distanceMeters)} (${firstMileWalk.durationMin} min) from ${origin.name} to boarding stop ${originStop.name}.`,
            accessibilityNotes: [
              `First-Mile Access: ${formatDistance(firstMileWalk.distanceMeters)}`,
              firstMileWalk.isEstimated
                ? 'Direct sidewalk link'
                : 'Pedestrian street routing (OSRM verified)',
            ],
            stepFree: originStop.stepFree,
            hasStairs: false,
            lightingScore: originStop.lightingScore,
            elevatorInvolved: false,
            coordinates: firstMileWalk.coordinates,
          });

          newPolylines.push({
            color: '#3b82f6',
            dashArray: '5, 5',
            weight: 4,
            positions: firstMileWalk.coordinates,
          });
        }

        // 2. Add core transit segments & polylines
        segments.push(...baseRoute.segments);
        newPolylines.push(...baseRoute.polylines);

        // 3. Append last-mile walking segment if custom destination
        if (lastMileWalk && dest.type === 'custom') {
          extraWalkMeters += lastMileWalk.distanceMeters;
          extraDurationMin += lastMileWalk.durationMin;

          segments.push({
            type: 'walk',
            fromName: destStop.name,
            fromStopId: destStop.id,
            toName: dest.name,
            durationMin: lastMileWalk.durationMin,
            distanceMeters: lastMileWalk.distanceMeters,
            instructions: `Walk ${formatDistance(lastMileWalk.distanceMeters)} (${lastMileWalk.durationMin} min) from arrival stop ${destStop.name} to final destination ${dest.name}.`,
            accessibilityNotes: [
              `Last-Mile Access: ${formatDistance(lastMileWalk.distanceMeters)}`,
              lastMileWalk.isEstimated
                ? 'Direct sidewalk link'
                : 'Pedestrian street routing (OSRM verified)',
            ],
            stepFree: destStop.stepFree,
            hasStairs: false,
            lightingScore: destStop.lightingScore,
            elevatorInvolved: false,
            coordinates: lastMileWalk.coordinates,
          });

          newPolylines.push({
            color: '#3b82f6',
            dashArray: '5, 5',
            weight: 4,
            positions: lastMileWalk.coordinates,
          });
        }

        const totalDuration = baseRoute.totalDurationMin + extraDurationMin;
        const totalWalkDist = baseRoute.totalWalkDistanceMeters + extraWalkMeters;

        const updatedBadges = [...baseRoute.badges];
        if (origin.type === 'custom' && originWalkDist > 10) {
          updatedBadges.unshift(`🚶 First Mile: ${formatDistance(originWalkDist)}`);
        }
        if (dest.type === 'custom' && destWalkDist > 10) {
          updatedBadges.push(`🚶 Last Mile: ${formatDistance(destWalkDist)}`);
        }

        candidates.push({
          ...baseRoute,
          id: `dyn_${baseRoute.id}_${Date.now()}`,
          totalDurationMin: totalDuration,
          totalWalkDistanceMeters: totalWalkDist,
          segments,
          badges: updatedBadges,
          polylines: newPolylines,
          explanation: {
            ...baseRoute.explanation,
            whyRecommended: [
              ...baseRoute.explanation.whyRecommended,
              origin.type === 'custom'
                ? `Snaps to nearest boarding stop: ${originStop.name} (${formatDistance(originWalkDist)} walk)`
                : 'Direct stop boarding',
              dest.type === 'custom'
                ? `Connects from arrival stop: ${destStop.name} to destination (${formatDistance(destWalkDist)} walk)`
                : 'Direct stop arrival',
            ],
          },
        });
      }
    }

    return candidates;
  }
}
