import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
  Pressable,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { useColors } from "@/hooks/useColors";

const GENRE_PRESETS = [
  {
    id: "afrobeats",
    label: "Afrobeats",
    lufs: "-9 LUFS",
    description: "Punchy sub-bass, bright percussion, modern African sound",
    gradient: ["#7B2FF7", "#B44FE8"] as const,
  },
  {
    id: "hiphop",
    label: "Hip-Hop",
    lufs: "-8 LUFS",
    description: "Deep 808s, crisp snares, radio-ready compression",
    gradient: ["#4F46E5", "#7C3AED"] as const,
  },
  {
    id: "trap",
    label: "Trap",
    lufs: "-8 LUFS",
    description: "Heavy bass, hi-hat rolls, cinematic dynamics",
    gradient: ["#9333EA", "#C026D3"] as const,
  },
  {
    id: "streaming",
    label: "Streaming",
    lufs: "-14 LUFS",
    description: "Balanced dynamics for Spotify & Apple Music",
    gradient: ["#0EA5E9", "#6366F1"] as const,
  },
  {
    id: "club",
    label: "Club",
    lufs: "-7 LUFS",
    description: "Maximized loudness for club systems",
    gradient: ["#EC4899", "#F43F5E"] as const,
  },
  {
    id: "warm_vinyl",
    label: "Warm Vinyl",
    lufs: "-12 LUFS",
    description: "Analog warmth, rich low-end, preserved transients",
    gradient: ["#D97706", "#F59E0B"] as const,
  },
];

const PROCESSING_STEPS = [
  "Analyzing frequencies...",
  "Detecting genre signature...",
  "Applying genre preset...",
  "Multi-band compression...",
  "De-essing & transient shaping...",
  "True-peak limiting...",
  "Finalizing master...",
];

export default function StudioScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [referenceTrack, setReferenceTrack] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState("afrobeats");
  const [variations, setVariations] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState("");

  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handlePickFile = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFile("my_track_session.wav");
  };

  const handlePickReference = async () => {
    await Haptics.selectionAsync();
    setReferenceTrack(referenceTrack ? null : "burnaboy_lastlast.mp3");
  };

  const handleMaster = async () => {
    if (!selectedFile || processing) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setProcessing(true);
    setProgress(0);
    progressAnim.setValue(0);

    let step = 0;
    setProcessingStep(PROCESSING_STEPS[0] ?? "Initializing...");

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.95, duration: 500, useNativeDriver: true }),
      ])
    );
    pulse.start();

    intervalRef.current = setInterval(() => {
      step++;
      const newPct = Math.min((step / PROCESSING_STEPS.length) * 95, 95);
      setProgress(Math.round(newPct));
      Animated.timing(progressAnim, {
        toValue: newPct / 100,
        duration: 550,
        useNativeDriver: false,
      }).start();
      setProcessingStep(PROCESSING_STEPS[step] ?? "Finalizing...");

      if (step >= PROCESSING_STEPS.length) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setTimeout(() => {
          setProgress(100);
          Animated.timing(progressAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start();
          pulse.stop();
          setTimeout(() => {
            setProcessing(false);
            setProgress(0);
            progressAnim.setValue(0);
            router.push("/job/1");
          }, 500);
        }, 700);
      }
    }, 800);
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad + 20, paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.wordmark, { color: colors.foreground }]}>
            PURE<Text style={{ color: colors.primary }}>MIX</Text>
            <Text style={{ color: colors.accent }}>.AI</Text>
          </Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
            AI MASTERING STUDIO
          </Text>
          <CrazyLines primary={colors.primary} accent={colors.accent} />
        </View>

        {/* Upload Drop Zone */}
        <Pressable
          onPress={handlePickFile}
          style={({ pressed }) => [
            styles.uploadZone,
            {
              borderColor: selectedFile ? colors.primary : colors.border,
              backgroundColor: selectedFile ? `${colors.primary}10` : colors.card,
              opacity: pressed ? 0.82 : 1,
            },
          ]}
        >
          {selectedFile ? (
            <>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <WaveformBars color={colors.primary} />
              </Animated.View>
              <Text style={[styles.fileName, { color: colors.foreground }]}>{selectedFile}</Text>
              <Text style={[styles.fileMeta, { color: colors.mutedForeground }]}>
                WAV · 44.1 kHz · 24-bit · 48 MB
              </Text>
              <TouchableOpacity
                onPress={() => setSelectedFile(null)}
                style={[styles.removeBtn, { borderColor: colors.border }]}
              >
                <Feather name="x" size={13} color={colors.mutedForeground} />
                <Text style={[styles.removeBtnText, { color: colors.mutedForeground }]}>Remove</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={[styles.uploadIconWrap, { backgroundColor: `${colors.primary}18` }]}>
                <Feather name="upload-cloud" size={38} color={colors.primary} />
              </View>
              <Text style={[styles.uploadTitle, { color: colors.foreground }]}>
                Upload your track
              </Text>
              <Text style={[styles.uploadHint, { color: colors.mutedForeground }]}>
                MP3 · WAV · FLAC up to 200 MB
              </Text>
            </>
          )}
        </Pressable>

        {/* Preset Section */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>GENRE PRESET</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetsRow}
        >
          {GENRE_PRESETS.map((preset) => {
            const isSelected = selectedPreset === preset.id;
            return (
              <TouchableOpacity
                key={preset.id}
                onPress={async () => {
                  await Haptics.selectionAsync();
                  setSelectedPreset(preset.id);
                }}
                activeOpacity={0.82}
                style={[
                  styles.presetCard,
                  {
                    backgroundColor: isSelected ? `${colors.primary}15` : colors.card,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
              >
                {isSelected && (
                  <LinearGradient
                    colors={preset.gradient}
                    style={StyleSheet.absoluteFillObject}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                )}
                <View style={{ zIndex: 1 }}>
                  <Text style={[styles.presetName, { color: colors.foreground }]}>
                    {preset.label}
                  </Text>
                  <Text style={[styles.presetLufs, { color: isSelected ? "#fff" : colors.primary }]}>
                    {preset.lufs}
                  </Text>
                  <Text
                    style={[styles.presetDesc, { color: isSelected ? "rgba(255,255,255,0.7)" : colors.mutedForeground }]}
                    numberOfLines={2}
                  >
                    {preset.description}
                  </Text>
                </View>
                {isSelected && (
                  <View style={styles.selectedDot}>
                    <Feather name="check" size={9} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Reference Track Row */}
        <TouchableOpacity
          onPress={handlePickReference}
          activeOpacity={0.8}
          style={[
            styles.variationsRow,
            {
              backgroundColor: referenceTrack ? `${colors.primary}10` : colors.card,
              borderColor: referenceTrack ? colors.primary : colors.border,
            },
          ]}
        >
          <View style={styles.variationsLeft}>
            <View style={[styles.variationsIconWrap, { backgroundColor: `${colors.primary}18` }]}>
              <Feather name="music" size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.variationsTitle, { color: colors.foreground }]}>
                Reference Track
                <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>  · optional</Text>
              </Text>
              <Text
                style={[styles.variationsSubtitle, { color: referenceTrack ? colors.primary : colors.mutedForeground }]}
                numberOfLines={1}
              >
                {referenceTrack ?? "Match a song you love — Matchering AI"}
              </Text>
            </View>
          </View>
          <View style={[styles.refBtn, { borderColor: referenceTrack ? colors.primary : colors.border }]}>
            <Feather
              name={referenceTrack ? "x" : "upload"}
              size={13}
              color={referenceTrack ? colors.primary : colors.mutedForeground}
            />
          </View>
        </TouchableOpacity>

        {/* AI Variations Row */}
        <TouchableOpacity
          onPress={async () => {
            await Haptics.selectionAsync();
            setVariations((v) => !v);
          }}
          activeOpacity={0.8}
          style={[styles.variationsRow, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={styles.variationsLeft}>
            <View style={[styles.variationsIconWrap, { backgroundColor: `${colors.primary}18` }]}>
              <Feather name="layers" size={16} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.variationsTitle, { color: colors.foreground }]}>AI Variations</Text>
              <Text style={[styles.variationsSubtitle, { color: colors.mutedForeground }]}>
                3 versions — clean, punchy, open
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.toggle,
              { backgroundColor: variations ? colors.primary : colors.secondary },
            ]}
          >
            <View style={[styles.toggleKnob, { transform: [{ translateX: variations ? 20 : 2 }] }]} />
          </View>
        </TouchableOpacity>

        {/* Processing state */}
        {processing && (
          <View style={[styles.processingBox, { backgroundColor: colors.card, borderColor: colors.primary }]}>
            <View style={styles.processingRow}>
              <WaveformBars color={colors.primary} small />
              <Text style={[styles.processingLabel, { color: colors.foreground }]}>{processingStep}</Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
              <Animated.View style={[styles.progressBar, { width: progressWidth, backgroundColor: colors.primary }]} />
            </View>
            <Text style={[styles.progressPct, { color: colors.mutedForeground }]}>{progress}%</Text>
          </View>
        )}
      </ScrollView>

      {/* Fixed bottom Master button */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 12),
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={handleMaster}
          disabled={!selectedFile || processing}
          activeOpacity={0.88}
          style={{ width: "100%" }}
        >
          <LinearGradient
            colors={!selectedFile || processing ? [colors.muted, colors.muted] : ["#7B2FF7", "#d94ed4"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.masterBtn, { opacity: !selectedFile || processing ? 0.45 : 1 }]}
          >
            {processing ? (
              <Text style={styles.masterBtnText}>Processing...</Text>
            ) : (
              <>
                <Feather name="zap" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.masterBtnText}>Master Track</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CrazyLines({ primary, accent }: { primary: string; accent: string }) {
  const BAR_COUNT = 48;
  const anims = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(Math.random()))
  ).current;

  useEffect(() => {
    const loops = anims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(a, {
            toValue: Math.random(),
            duration: 600 + (i % 6) * 90,
            delay: (i * 35) % 400,
            useNativeDriver: false,
          }),
          Animated.timing(a, {
            toValue: Math.random(),
            duration: 700 + (i % 5) * 100,
            useNativeDriver: false,
          }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [anims]);

  return (
    <View style={styles.crazyLines}>
      {anims.map((a, i) => {
        const h = a.interpolate({ inputRange: [0, 1], outputRange: [3, 22] });
        const isAccent = i % 5 === 0;
        return (
          <Animated.View
            key={i}
            style={{
              width: 2.5,
              height: h,
              borderRadius: 1.5,
              marginHorizontal: 1.5,
              backgroundColor: isAccent ? accent : primary,
              opacity: 0.55 + (i % 4) * 0.12,
            }}
          />
        );
      })}
    </View>
  );
}

function WaveformBars({ color, small = false }: { color: string; small?: boolean }) {
  const bars = small
    ? [10, 16, 12, 20, 14, 18, 10]
    : [16, 28, 20, 36, 24, 32, 20, 36, 24, 16, 28, 20];
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {bars.map((h, i) => (
        <View
          key={i}
          style={{
            width: small ? 3 : 4,
            height: h,
            borderRadius: 2,
            backgroundColor: color,
            marginHorizontal: 1.5,
            opacity: 0.6 + (i % 4) * 0.1,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  header: { alignItems: "center", marginBottom: 24 },
  crazyLines: {
    flexDirection: "row",
    alignItems: "center",
    height: 26,
    marginTop: 10,
    justifyContent: "center",
  },
  wordmark: { fontSize: 26, fontFamily: "Inter_700Bold", letterSpacing: 3 },
  tagline: { fontSize: 9, fontFamily: "Inter_500Medium", letterSpacing: 3, marginTop: 3 },
  uploadZone: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 16,
    padding: 30,
    alignItems: "center",
    gap: 10,
    marginBottom: 24,
  },
  uploadIconWrap: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  uploadTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  uploadHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
  fileName: { fontSize: 15, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  fileMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  removeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 4,
  },
  removeBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 2,
    marginBottom: 10,
  },
  presetsRow: { gap: 10, paddingBottom: 4, marginBottom: 20 },
  presetCard: {
    width: 148,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 4,
    overflow: "hidden",
    position: "relative",
  },
  presetName: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
  presetLufs: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  presetDesc: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 3 },
  selectedDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  variationsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  variationsLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  variationsIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  variationsTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  variationsSubtitle: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  refBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  toggle: { width: 44, height: 26, borderRadius: 13, justifyContent: "center", padding: 2 },
  toggleKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff" },
  processingBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 10,
    marginBottom: 20,
  },
  processingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  processingLabel: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  progressTrack: { height: 3, borderRadius: 2, overflow: "hidden" },
  progressBar: { height: "100%", borderRadius: 2 },
  progressPct: { fontSize: 11, fontFamily: "Inter_500Medium", textAlign: "right" },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
  },
  masterBtn: {
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  masterBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: 0.4 },
});
