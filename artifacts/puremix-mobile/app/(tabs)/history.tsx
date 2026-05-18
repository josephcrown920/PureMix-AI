import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";

interface MasterJob {
  id: number;
  filename: string;
  preset: string;
  inputLufs: number;
  outputLufs: number;
  date: string;
  status: "completed" | "failed" | "processing";
  duration: string;
}

const MOCK_JOBS: MasterJob[] = [
  {
    id: 1,
    filename: "mud_in_my_veins.wav",
    preset: "Afrobeats",
    inputLufs: -18.4,
    outputLufs: -9.0,
    date: "Today, 2:31 PM",
    status: "completed",
    duration: "3:47",
  },
  {
    id: 2,
    filename: "night_drive_final.wav",
    preset: "Hip-Hop",
    inputLufs: -20.1,
    outputLufs: -8.0,
    date: "Yesterday, 9:14 AM",
    status: "completed",
    duration: "4:12",
  },
  {
    id: 3,
    filename: "lagos_summer_v3.mp3",
    preset: "Afrobeats",
    inputLufs: -22.5,
    outputLufs: -9.0,
    date: "May 16, 11:02 PM",
    status: "completed",
    duration: "3:58",
  },
  {
    id: 4,
    filename: "trap_session_001.wav",
    preset: "Trap",
    inputLufs: -19.8,
    outputLufs: -8.0,
    date: "May 15, 6:45 PM",
    status: "completed",
    duration: "2:55",
  },
  {
    id: 5,
    filename: "demo_rough_mix.wav",
    preset: "Streaming",
    inputLufs: -24.2,
    outputLufs: -14.0,
    date: "May 14, 3:30 PM",
    status: "failed",
    duration: "5:22",
  },
  {
    id: 6,
    filename: "afro_fusion_mix.flac",
    preset: "Afrobeats",
    inputLufs: -17.9,
    outputLufs: -9.0,
    date: "May 13, 8:22 AM",
    status: "completed",
    duration: "4:01",
  },
];

const PRESET_COLOR: Record<string, string> = {
  Afrobeats: "#a066f5",
  "Hip-Hop": "#6366f1",
  Trap: "#c026d3",
  Club: "#ec4899",
  Streaming: "#0ea5e9",
  "Warm Vinyl": "#d97706",
  Broadcast: "#64748b",
};

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 1200));
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: MasterJob }) => {
    const lufsGain = Math.abs(item.outputLufs - item.inputLufs).toFixed(1);
    const presetColor = PRESET_COLOR[item.preset] ?? colors.primary;
    const isCompleted = item.status === "completed";
    const isFailed = item.status === "failed";

    return (
      <TouchableOpacity
        onPress={async () => {
          if (!isCompleted) return;
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/job/${item.id}`);
        }}
        activeOpacity={isCompleted ? 0.78 : 1}
        style={[
          styles.jobCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: isFailed ? 0.6 : 1,
          },
        ]}
      >
        {/* Left: file icon */}
        <View style={[styles.fileIcon, { backgroundColor: `${presetColor}18` }]}>
          <Feather name="music" size={18} color={presetColor} />
        </View>

        {/* Middle: info */}
        <View style={styles.jobInfo}>
          <Text
            style={[styles.jobFilename, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {item.filename}
          </Text>
          <View style={styles.jobMeta}>
            <View style={[styles.presetBadge, { backgroundColor: `${presetColor}18` }]}>
              <Text style={[styles.presetBadgeText, { color: presetColor }]}>{item.preset}</Text>
            </View>
            <Text style={[styles.jobDate, { color: colors.mutedForeground }]}>{item.date}</Text>
          </View>
        </View>

        {/* Right: LUFS delta or error */}
        {isCompleted ? (
          <View style={styles.lufsBlock}>
            <Text style={[styles.lufsGain, { color: colors.primary }]}>+{lufsGain}</Text>
            <Text style={[styles.lufsUnit, { color: colors.mutedForeground }]}>LUFS</Text>
          </View>
        ) : (
          <View style={styles.lufsBlock}>
            <Feather name="alert-circle" size={18} color="#ef4444" />
          </View>
        )}

        {isCompleted && (
          <Feather name="chevron-right" size={16} color={colors.border} style={{ marginLeft: 2 }} />
        )}
      </TouchableOpacity>
    );
  };

  const completed = MOCK_JOBS.filter((j) => j.status === "completed").length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={MOCK_JOBS}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        scrollEnabled={!!MOCK_JOBS.length}
        contentContainerStyle={[
          styles.list,
          { paddingTop: topPad + 20, paddingBottom: bottomPad + 100 },
        ]}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={[styles.pageTitle, { color: colors.foreground }]}>History</Text>
            <View style={[styles.statPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="check-circle" size={12} color={colors.primary} />
              <Text style={[styles.statPillText, { color: colors.foreground }]}>
                {completed} mastered
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="inbox" size={40} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No masters yet
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.mutedForeground }]}>
              Upload a track in Studio to get started
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingHorizontal: 20 },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  pageTitle: { fontSize: 26, fontFamily: "Inter_700Bold" },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statPillText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  jobCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  fileIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  jobInfo: { flex: 1, gap: 5 },
  jobFilename: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  jobMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  presetBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  presetBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  jobDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
  lufsBlock: { alignItems: "center", minWidth: 40 },
  lufsGain: { fontSize: 15, fontFamily: "Inter_700Bold" },
  lufsUnit: { fontSize: 9, fontFamily: "Inter_500Medium", marginTop: 1 },
  empty: { alignItems: "center", paddingTop: 80, gap: 10 },
  emptyText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptySubtext: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
});
