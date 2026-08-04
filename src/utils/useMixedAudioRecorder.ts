/**
 * useMixedAudioRecorder.ts
 *
 * React custom hook port of the vanilla `MixedAudioRecorder` class.
 * Mixes multiple MediaStreams' audio tracks into a single output stream
 * using the Web Audio API (useful for combining mic + remote peer audio
 * before recording, e.g. with MediaRecorder).
 *
 * Credits:
 * - https://github.com/muaz-khan/MultiStreamsMixer
 * - https://stackoverflow.com/questions/46074239/record-multi-audio-tracks-available-in-a-stream-with-mediarecorder
 *
 * Usage in App.tsx:
 *
 *   const { getMixedAudioStream, stopMixedAudioStream } = useMixedAudioRecorder();
 *
 *   const start = () => {
 *     const mixedStream = getMixedAudioStream([localStream, remoteStream]);
 *     // e.g. pass mixedStream (plus a video track) into a MediaRecorder
 *   };
 *
 *   const stop = () => {
 *     stopMixedAudioStream();
 *   };
 *
 * The hook automatically tears down the AudioContext on unmount if it
 * hasn't been stopped manually already.
 */

import { useCallback, useEffect, useRef } from "react";

// Some older browsers exposed vendor-prefixed AudioContext constructors.
interface WindowWithVendorAudioContext extends Window {
  webkitAudioContext?: typeof AudioContext;
  mozAudioContext?: typeof AudioContext;
}

export interface UseMixedAudioRecorderResult {
  /** Mixes the audio tracks of the given streams into one output MediaStream. */
  getMixedAudioStream: (audioStreams: (MediaStream | null | undefined)[]) => MediaStream;
  /** Disconnects all nodes and closes the underlying AudioContext. */
  stopMixedAudioStream: () => void;
}

export function useMixedAudioRecorder(useGainNode = true): UseMixedAudioRecorderResult {
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioSourcesRef = useRef<MediaStreamAudioSourceNode[]>([]);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  const createAudioContext = useCallback((): AudioContext => {
    const w = window as WindowWithVendorAudioContext;
    if (window.AudioContext) {
      return new AudioContext();
    } else if (w.webkitAudioContext) {
      return new w.webkitAudioContext();
    } else if (w.mozAudioContext) {
      return new w.mozAudioContext();
    } else {
      throw new Error("Web Audio API is not supported in this browser");
    }
  }, []);

  const stopMixedAudioStream = useCallback(() => {
    if (useGainNode && gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }
    if (audioSourcesRef.current.length) {
      audioSourcesRef.current.forEach((source) => source.disconnect());
      audioSourcesRef.current = [];
    }
    if (audioDestinationRef.current) {
      audioDestinationRef.current.disconnect();
      audioDestinationRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    console.log("Stop Mixed Audio Stream");
  }, [useGainNode]);

  const getMixedAudioStream = useCallback(
    (audioStreams: (MediaStream | null | undefined)[]): MediaStream => {
      // Lazily (re)create the AudioContext if it isn't open
      if (!audioContextRef.current) {
        audioContextRef.current = createAudioContext();
      }
      const audioContext = audioContextRef.current;

      audioSourcesRef.current = [];

      if (useGainNode) {
        const gainNode = audioContext.createGain();
        gainNode.connect(audioContext.destination);
        gainNode.gain.value = 0;
        gainNodeRef.current = gainNode;
      }

      audioStreams.forEach((stream) => {
        if (!stream || !stream.getTracks().filter((t) => t.kind === "audio").length) {
          return;
        }

        console.log(
          "Mixed audio tracks to add on MediaStreamAudioDestinationNode --->",
          stream.getTracks(),
        );

        const audioSource = audioContext.createMediaStreamSource(stream);

        if (useGainNode && gainNodeRef.current) {
          audioSource.connect(gainNodeRef.current);
        }
        audioSourcesRef.current.push(audioSource);
      });

      const audioDestination = audioContext.createMediaStreamDestination();
      audioSourcesRef.current.forEach((audioSource) => {
        audioSource.connect(audioDestination);
      });
      audioDestinationRef.current = audioDestination;

      return audioDestination.stream;
    },
    [useGainNode, createAudioContext],
  );

  // Safety net: clean up if the component unmounts without calling stop manually.
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        stopMixedAudioStream();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { getMixedAudioStream, stopMixedAudioStream };
}

export default useMixedAudioRecorder;
