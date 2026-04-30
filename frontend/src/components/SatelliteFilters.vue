<template>
  <div class="satellite-filters">
    <a-select
      v-model:value="localFilterType"
      class="filter-select"
      :dropdown-match-select-width="false"
      placeholder="轨道类型"
      allow-clear
      @change="emit('update:filterType', $event)"
    >
      <a-select-option value="leo">低轨 (LEO)</a-select-option>
      <a-select-option value="meo">中轨 (MEO)</a-select-option>
      <a-select-option value="geo">地球同步 (GEO)</a-select-option>
      <a-select-option value="heo">高轨 (HEO)</a-select-option>
    </a-select>

    <a-select
      v-model:value="localSelectedCountry"
      class="filter-select"
      :dropdown-match-select-width="false"
      placeholder="国家/地区"
      allow-clear
      @change="emit('update:selectedCountry', $event)"
    >
      <a-select-option v-for="country in mergedCountries" :key="country.code" :value="country.code">
        <div class="country-option">
          <FlagIcon
            v-if="country.code"
            :code="country.code"
            :country-name="getCountryName(country.code)"
            class="flag-icon"
          />
          <span class="country-name">{{ getCountryName(country.code) }}</span>
          <!-- <span class="country-count">({{ country.count }})</span> -->
        </div>
      </a-select-option>
    </a-select>

    <a-select
      v-model:value="localSelectedMission"
      class="filter-select"
      :dropdown-match-select-width="false"
      placeholder="用途分类"
      allow-clear
      @change="emit('update:selectedMission', $event)"
    >
      <a-select-option v-for="mission in sortedMissions" :key="mission.name" :value="mission.name">
        <div class="mission-option">
          <span class="mission-name">{{ mission.name }}</span>
          <!-- <span class="mission-count">({{ mission.count }})</span> -->
        </div>
      </a-select-option>
    </a-select>

    <a-select
      v-model:value="localFavoriteFilter"
      class="filter-select"
      :dropdown-match-select-width="false"
      placeholder="收藏状态"
      allow-clear
      @change="emit('update:favoriteFilter', $event)"
    >
      <a-select-option value="favorited">已收藏</a-select-option>
      <a-select-option value="unfavorited">未收藏</a-select-option>
    </a-select>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import FlagIcon from "./FlagIcon.vue";
import { COUNTRY_NAMES } from "@/constants/satellite";

interface Country {
  code: string;
  count: number;
}

interface Mission {
  name: string;
  count: number;
}

interface Props {
  filterType: string | null;
  selectedCountry: string | null;
  selectedMission: string | null;
  favoriteFilter: string | null;
  countries: Country[];
  missions: Mission[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  "update:filterType": [value: string | null];
  "update:selectedCountry": [value: string | null];
  "update:selectedMission": [value: string | null];
  "update:favoriteFilter": [value: string | null];
}>();

const localFilterType = ref<string | null>(props.filterType);
const localSelectedCountry = ref<string | null>(props.selectedCountry);
const localSelectedMission = ref<string | null>(props.selectedMission);
const localFavoriteFilter = ref<string | null>(props.favoriteFilter);

watch(
  () => props.filterType,
  (val) => {
    localFilterType.value = val;
  },
);
watch(
  () => props.selectedCountry,
  (val) => {
    localSelectedCountry.value = val;
  },
);
watch(
  () => props.selectedMission,
  (val) => {
    localSelectedMission.value = val;
  },
);
watch(
  () => props.favoriteFilter,
  (val) => {
    localFavoriteFilter.value = val;
  },
);

const getCountryName = (code: string): string => {
  return COUNTRY_NAMES[code] || "其他";
};

const mergedCountries = computed(() => {
  const nameToEntry = new Map<string, { code: string; count: number }>();

  props.countries.forEach((c) => {
    const name = getCountryName(c.code);
    if (nameToEntry.has(name)) {
      const entry = nameToEntry.get(name)!;
      entry.count += c.count;
      if (name === "中国" && c.code === "CN") {
        entry.code = "CN";
      }
    } else {
      const code = name === "其他" ? "OTHER" : c.code;
      nameToEntry.set(name, { code, count: c.count });
    }
  });

  const result = Array.from(nameToEntry.values());

  const priorityOrder: Record<string, number> = {
    中国: 0,
    美国: 1,
    俄罗斯: 2,
    其他: 100,
  };

  result.sort((a, b) => {
    const nameA = getCountryName(a.code);
    const nameB = getCountryName(b.code);
    const priorityA = priorityOrder[nameA] ?? 50;
    const priorityB = priorityOrder[nameB] ?? 50;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    if (priorityA === 50) {
      return b.count - a.count;
    }
    return 0;
  });

  return result;
});

const sortedMissions = computed(() => {
  const priorityOrder: Record<string, number> = {
    通信: 0,
    导航: 1,
    遥感: 2,
    其他: 100,
  };

  return [...props.missions].sort((a, b) => {
    const priorityA = priorityOrder[a.name] ?? 50;
    const priorityB = priorityOrder[b.name] ?? 50;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    if (priorityA === 50) {
      return a.name.localeCompare(b.name);
    }
    return 0;
  });
});
</script>

<style scoped lang="scss">
.satellite-filters {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.filter-select {
  width: 100%;

  :deep(.ant-select-selector) {
    width: 100%;
    height: 41px !important;
    padding: 0 52px 0 14px !important;
    background: rgba(0, 212, 255, 0.04) !important;
    border: 1px solid rgba(0, 212, 255, 0.12) !important;
    border-radius: 14px !important;
    box-shadow: none !important;

    &:hover {
      border-color: rgba(0, 212, 255, 0.25) !important;
    }
  }

  :deep(.ant-select-selection-search) {
    inset-inline-start: 14px;
  }

  :deep(.ant-select-selection-search-input) {
    height: 39px !important;
    background: transparent !important;
    color: #fff !important;
    font-size: 13px !important;
  }

  :deep(.ant-select-selection-item) {
    color: rgba(255, 255, 255, 0.85);
    font-size: 13px;
    line-height: 39px !important;
    padding-inline-end: 0 !important;
  }

  :deep(.ant-select-selection-placeholder) {
    color: rgba(255, 255, 255, 0.3);
    font-size: 13px;
    line-height: 39px !important;
    padding-inline-end: 0 !important;
  }

  :deep(.ant-select-arrow) {
    color: rgba(255, 255, 255, 0.35);
    right: 14px;
    top: 50% !important;
    transform: translateY(-50%);
    margin-top: 0;
  }

  :deep(.ant-select-clear) {
    right: 14px;
    top: 50%;
    transform: translateY(-50%);
    margin-top: 0;
    color: rgba(255, 255, 255, 0.4);
    background: transparent;

    &:hover {
      color: rgba(255, 255, 255, 0.65);
      background: transparent;
    }
  }

  &.ant-select-focused {
    :deep(.ant-select-selector) {
      border-color: #00d4ff !important;
      box-shadow:
        0 0 0 3px rgba(0, 212, 255, 0.1),
        0 0 20px rgba(0, 212, 255, 0.1) !important;
    }
  }

  :deep(.ant-select-dropdown) {
    background: rgba(16, 24, 40, 0.95);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(0, 212, 255, 0.15);
    border-radius: 12px;
    padding: 6px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  :deep(.ant-select-item) {
    color: rgba(255, 255, 255, 0.85);
    font-size: 13px;
    border-radius: 8px;
    padding: 8px 12px;
    margin: 2px 0;
    min-height: 36px;
    line-height: 20px !important;

    &:hover {
      background: rgba(0, 212, 255, 0.08);
    }
  }

  :deep(.ant-select-item-option-selected) {
    background: rgba(0, 212, 255, 0.15) !important;
    font-weight: 500;
  }

  :deep(.ant-select-item-option-active) {
    background: rgba(0, 212, 255, 0.08) !important;
  }
}

.country-option,
.mission-option {
  display: flex;
  align-items: center;
  gap: 8px;

  .flag-icon {
    font-size: 14px;
  }

  .country-name,
  .mission-name {
    flex: 1;
  }

  .country-count,
  .mission-count {
    color: rgba(255, 255, 255, 0.4);
    font-size: 12px;
  }
}
</style>
