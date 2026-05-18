import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";

const MOCK_JOB = {
  id: 1,
  filename: "mud_in_my_veins.wav",
  preset: "Afrobeats",
  inputLufs: -18.4,
  outputLufs: -9.0,
  truePeak: -0.3,
  lufsRange: "7.2 LU",
  stereoWidth: "87%",
  duration: "3:47",
  completedAt: "Today, 2:38 PM",
  hasVariations: true,
};

const VARIANTS = [
  { id: "clean", label: "Clean", desc: "Transparent, true to mix", lufs: -9.0 },
  { id: "punchy", label: "Punchy", desc: "Enhanced transients, more attack", lufs: -8.5 },
  { id: "open", label: "Open", desc: "Wide stereo, airy high end", lufs: -9.3 },
];

export default function JobScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [playing, setPlaying] = useState<"original" | "master" | null>(null);
  const [selectedVariant, setSelectedVariant] = useState("clean");
  const [playProgress, setPlayProgress] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const lufsGain = Math.abs(MOCK_JOB.outputLufs - MOCK_JOB.inputLufs).toFixed(1);

  const handlePlay = async (track: "original" | "master") => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (playing === track) {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
      setPlaying(null);
      setPlayProgress(0);
      progressAnim.setValue(0);
      return;
    }
    setPlaying(track);
    setPlayProgress(0);
    progressAnim.setValue(0);
    if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    playIntervalRef.current = setInterval(() => {
      setPlayProgress((p) => {
        const next = p + 1;
        if (next >= 100) {
          if (playIntervalRef.current) clearInterval(playIntervalRef.current);
          setPlaying(null);
          return 0;
        }
        Animated.timing(progressAnim, {
          toValue: next / 100,
          duration: 200,
          useNativeDriver: false,
        }).start();
        return next;
      });
    }, 220);
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 16, paddingBottom: bottomPad + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title row */}
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <Text style={[styles.filename, { color: colors.foreground }]} numberOfLines={1}>
              {MOCK_JOB.filename}
            </Text>
            <View style={styles.badgeRow}>
              <View style={[styles.presetBadge, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}40` }]}>
                <Text style={[styles.presetBadgeText, { color: colors.primary }]}>{MOCK_JOB.preset}</Text>
              </View>
              <Text style={[styles.completedAt, { color: colors.mutedForeground }]}>
                {MOCK_JOB.completedAt}
              </Text>
            </View>
          </View>
        </View>

        {/* LUFS Delta Hero Card */}
        <LinearGradient
          colors={["#1e0f35", "#0f0b1a"]}
          style={[styles.heroCard, { borderColor: colors.border }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.lufsRow}>
            <View style={styles.lufsBlock}>
              <Text style={[styles.lufsLabel, { color: colors.mutedForeground }]}>BEFORE</Text>
              <Text style={[styles.lufsValue, { color: colors.foreground }]}>
                {MOCK_JOB.inputLufs.toFixed(1)}
              </Text>
              <Text style={[styles.lufsUnit, { color: colors.mutedForeground }]}>LUFS</Text>
            </View>
            <View style={styles.lufsDivider}>
              <LinearGradient
                colors={[colors.primary, colors.accent]}
                style={styles.arrowGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Feather name="arrow-right" size={16} color="#fff" />
              </LinearGradient>
              <Text style={[styles.gainLabel, { color: colors.primary }]}>+{lufsGain} LUFS</Text>
            </View>
            <View style={styles.lufsBlock}>
              <Text style={[styles.lufsLabel, { color: colors.mutedForeground }]}>AFTER</Text>
              <Text style={[styles.lufsValue, { color: colors.primary }]}>
                {MOCK_JOB.outputLufs.toFixed(1)}
              </Text>
              <Text style={[styles.lufsUnit, { color: colors.mutedForeground }]}>LUFS</Text>
            </View>
          </View>

          {/* Mini stats */}
          <View style={[styles.miniStats, { borderTopColor: colors.border }]}>
            <MiniStat colors={colors} label="TRUE PEAK" value={`${MOCK_JOB.truePeak} dBTP`} />
            <MiniStat colors={colors} label="LRA" value={MOCK_JOB.lufsRange} />
            <MiniStat colors={colors} label="STEREO WIDTH" value={MOCK_JOB.stereoWidth} />
            <MiniStat colors={colors} label="DURATION" value={MOCK_JOB.duration} />
          </View>
        </LinearGradient>

        {/* Players */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>A/B COMPARE</Text>
        <PlayerRow
          colors={colors}
          label="Original Mix"
          subtitle="Pre-master · unprocessed"
          playing={playing === "original"}
          onPlay={() => handlePlay("original")}
          progressWidth={playing === "original" ? progressWidth : "0%"}
        />
        <PlayerRow
          colors={colors}
          label="Mastered"
          subtitle={`${MOCK_JOB.preset} preset · ${MOCK_JOB.outputLufs} LUFS`}
          playing={playing === "master"}
          onPlay={() => handlePlay("master")}
          progressWidth={playing === "master" ? progressWidth : "0%"}
          accent
        />

        {/* Variant Selector */}
        {MOCK_JOB.hasVariations && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>AI VARIATIONS</Text>
            {VARIANTS.map((v) => {
              const isSelected = selectedVariant === v.id;
              return (
                <TouchableOpacity
                  key={v.id}
                  onPress={async () => {
                    await Haptics.selectionAsync();
                    setSelectedVariant(v.id);
                  }}
                  activeOpacity={0.8}
                  style={[
                    styles.variantRow,
                    {
                      backgroundColor: isSelected ? `${colors.primary}12` : colors.card,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <View style={[styles.variantDot, { backgroundColor: isSelected ? colors.primary : colors.border }]} />
                  <View style={styles.variantInfo}>
                    <Text style={[styles.variantLabel, { color: colors.foreground }]}>{v.label}</Text>
                    <Text style={[styles.variantDesc, { color: colors.mutedForeground }]}>{v.desc}</Text>
                  </View>
                  <Text style={[styles.variantLufs, { color: isSelected ? colors.primary : colors.mutedForeground }]}>
                    {v.lufs.toFixed(1)} LUFS
                  </Text>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* Download Button */}
        <TouchableOpacity
          onPress={async () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)}
          activeOpacity={0.85}
          style={{ marginTop: 24 }}
        >
          <LinearGradient
            colors={["#7B2FF7", "#d94ed4"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.downloadBtn}
          >
            <Feather name="download" size={18} color="#fff" />
            <Text style={styles.downloadBtnText}>Download Master</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function PlayerRow({
  colors,
  label,
  subtitle,
  playing,
  onPlay,
  progressWidth,
  accent = false,
}: {
  colors: ReturnType<typeof useColors>;
  label: string;
  subtitle: string;
  playing: boolean;
  onPlay: () => void;
  progressWidth: string | Animated.AnimatedInterpolation<string>;
  accent?: boolean;
}) {
  const trackColor = accent ? colors.primary : colors.mutedForeground;
  return (
    <View
      style={[
        styles.playerCard,
        {
          backgroundColor: colors.card,
          borderColor: playing ? colors.primary : colors.border,
        },
      ]}
    >
      <TouchableOpacity
        onPress={onPlay}
        style={[styles.playBtn, { backgroundColor: playing ? colors.primary : `${trackColor}20` }]}
      >
        <Feather name={playing ? "pause" : "play"} size={18} color={playing ? "#fff" : trackColor} />
      </TouchableOpacity>
      <View style={styles.playerInfo}>
        <Text style={[styles.playerLabel, { color: colors.foreground }]}>{label}</Text>
        <Text style={[styles.playerSub, { color: colors.mutedForeground }]}>{subtitle}</Text>
        <View style={[styles.playerTrack, { backgroundColor: colors.border }]}>
          <Animated.View
            style={[styles.playerProgress, { width: progressWidth as any, backgroundColor: trackColor }]}
          />
        </View>
      </View>
    </View>
  );
}

function MiniStat({
  colors,
  label,
  value,
}: {
  colors: ReturnType<typeof useColors>;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.miniStat}>
      <Text style={[styles.miniStatLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.miniStatValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  titleRow: { marginBottom: 20 },
  titleBlock: { gap: 6 },
  filename: { fontSize: 18, fontFamily: "Inter_700Bold" },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  presetBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  presetBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  completedAt: { fontSize: 11, fontFamily: "Inter_400Regular" },
  heroCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 20,
    marginBottom: 24,
    gap: 16,
  },
  lufsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  lufsBlock: { alignItems: "center", gap: 2, flex: 1 },
  lufsLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 1 },
  lufsValue: { fontSize: 32, fontFamily: "Inter_700Bold" },
  lufsUnit: { fontSize: 10, fontFamily: "Inter_500Medium" },
  lufsDivider: { alignItems: "center", gap: 6 },
  arrowGradient: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  gainLabel: { fontSize: 11, fontFamily: "Inter_700Bold" },
  miniStats: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingTop: 14,
    gap: 4,
  },
  miniStat: { flex: 1, alignItems: "center", gap: 3 },
  miniStatLabel: { fontSize: 8, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  miniStatValue: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 2,
    marginBottom: 10,
    marginTop: 4,
  },
  playerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  playerInfo: { flex: 1, gap: 3 },
  playerLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  playerSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  playerTrack: { height: 3, borderRadius: 2, marginTop: 4, overflow: "hidden" },
  playerProgress: { height: "100%", borderRadius: 2 },
  variantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  variantDot: { width: 10, height: 10, borderRadius: 5 },
  variantInfo: { flex: 1 },
  variantLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  variantDesc: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  variantLufs: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  downloadBtn: {
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  downloadBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
});
