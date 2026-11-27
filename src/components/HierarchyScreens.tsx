import React, { useState, useEffect } from 'react';
import { Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  ArrowLeft,
  ChevronRight,
  Cpu,
  Plus,
  ShieldCheck,
  Wifi,
} from 'lucide-react-native';
import * as Updates from 'expo-updates';
import type {
  ConnectionMode,
  ControllerModel,
  FacilityNode,
  FacilityType,
  FarmEstate,
} from '../types/telemetry';
import type {
  AddFacilityInput,
  AddFarmInput,
  LinkControllerInput,
} from '../hooks/useMobileTelemetry';
import {
  CONTROLLER_MODELS,
  FACILITY_TYPE_LABELS,
} from '../data/farmsSeed';
import { FarmOneSvg, FarmTwoSvg } from './graphics/NativeGraphics';
import { mobileStyles as styles } from '../styles/mobileStyles';

interface FarmsHomeViewProps {
  farms: FarmEstate[];
  activeAlarmsCount: number;
  connectionMode: ConnectionMode;
  statusBadgeText: string;
  statusBadgeColor: string;
  statusBadgeBg: string;
  onOpenFarm: (farmId: string) => void;
  onOpenAddFarm: () => void;
  onOpenAddDevice: () => void;
}

export const FarmsHomeView: React.FC<FarmsHomeViewProps> = ({
  farms,
  activeAlarmsCount,
  connectionMode,
  statusBadgeText,
  statusBadgeColor,
  statusBadgeBg,
  onOpenFarm,
  onOpenAddFarm,
  onOpenAddDevice,
}) => {
  const totalFacilities = farms.reduce((sum, f) => sum + f.facilities.length, 0);
  const totalControllers = farms.reduce(
    (sum, f) =>
      sum + f.facilities.reduce((cSum, fac) => cSum + fac.controllers.length, 0),
    0
  );

  return (
    <View style={styles.screenGap}>
      <View style={styles.rowBetweenStart}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>My farms</Text>
          <View style={styles.liveSubtitleRow}>
            <View style={[styles.dotIndicator, { backgroundColor: '#15803D' }]} />
            <Text style={styles.liveSubtitle}>
              {connectionMode === 'DEMO_SAFE'
                ? 'Safe Demo Telemetry Active'
                : 'Live Edge Telemetry'}
            </Text>
          </View>
        </View>

        <View style={[styles.pillBadge, { backgroundColor: statusBadgeBg }]}>
          <Text style={[styles.pillBadgeText, { color: statusBadgeColor }]}>
            {statusBadgeText}
          </Text>
        </View>
      </View>

      {/* First-Page Actions: Add Farm / Place & Link Controller Device */}
      <View style={styles.actionPairRow}>
        <TouchableOpacity
          style={[styles.primaryEmeraldBtn, { flex: 1 }]}
          onPress={onOpenAddFarm}
          activeOpacity={0.85}
        >
          <Plus size={15} color="#FFFFFF" />
          <Text style={styles.primaryDarkBtnText}>Add Farm / Place</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryDarkBtn, { flex: 1 }]}
          onPress={onOpenAddDevice}
          activeOpacity={0.85}
        >
          <Cpu size={15} color="#34D399" />
          <Text style={styles.primaryDarkBtnText}>Add Device</Text>
        </TouchableOpacity>
      </View>

      {/* 3 Summary KPI Cards matching SCADA hierarchy */}
      <View style={styles.kpiRow3}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Farms</Text>
          <Text style={styles.kpiValue}>{farms.length}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Facilities</Text>
          <Text style={styles.kpiValue}>{totalFacilities}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text
            style={[
              styles.kpiLabel,
              activeAlarmsCount > 0 && { color: '#DC2626' },
            ]}
          >
            Controllers / Alarms
          </Text>
          <Text
            style={[
              styles.kpiValue,
              activeAlarmsCount > 0 && { color: '#DC2626' },
            ]}
          >
            {totalControllers} / {activeAlarmsCount}
          </Text>
        </View>
      </View>

      {/* Farm Estates List */}
      {farms.map((farm) => {
        const ctrlCount = farm.facilities.reduce(
          (sum, fac) => sum + fac.controllers.length,
          0
        );
        const hasAttention = farm.facilities.some((fac) =>
          fac.controllers.some((c) => c.status === 'ATTENTION')
        );
        const growingFacs = farm.facilities.filter((f) => f.metrics.ec > 0);
        const avgEc =
          growingFacs.length > 0
            ? (
                growingFacs.reduce((sum, f) => sum + f.metrics.ec, 0) /
                growingFacs.length
              ).toFixed(2)
            : '0.00';

        return (
          <TouchableOpacity
            key={farm.id}
            style={styles.farmCard}
            onPress={() => onOpenFarm(farm.id)}
            activeOpacity={0.88}
          >
            <View style={styles.farmArtWrap}>
              {farm.visualKind === 'polybay' ? <FarmTwoSvg /> : <FarmOneSvg />}
            </View>

            <View style={styles.rowBetweenCenter}>
              <View
                style={[
                  styles.pillBadge,
                  { backgroundColor: hasAttention ? '#FEF3C7' : '#DCFCE7' },
                ]}
              >
                <Text
                  style={[
                    styles.pillBadgeText,
                    { color: hasAttention ? '#B45309' : '#15803D' },
                  ]}
                >
                  {hasAttention ? '1 ATTENTION' : 'ALL ONLINE'}
                </Text>
              </View>
              <Text style={styles.mutedSmall}>{farm.location}</Text>
            </View>

            <Text style={styles.farmTitle}>{farm.name}</Text>
            <Text style={styles.mutedSmall}>{farm.crop}</Text>

            <View style={styles.farmCardFooter}>
              <Text style={styles.farmMeta}>
                {farm.facilities.length} Facilities · {ctrlCount} Ctrl · Avg EC{' '}
                <Text style={styles.farmEcStrong}>{avgEc} mS</Text>
              </Text>
              <View style={styles.drillBadge}>
                <Text style={styles.drillBadgeText}>Facilities</Text>
                <ChevronRight size={12} color="#34D399" />
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

interface FacilitiesListViewProps {
  farm: FarmEstate;
  onBackToFarms: () => void;
  onOpenFacility: (facilityId: string) => void;
  onOpenAddDeviceForFarm: () => void;
  onAddFacility: (
    farmId: string,
    input: AddFacilityInput
  ) => { ok: true; facilityId: string } | { ok: false; error: string };
}

export const FacilitiesListView: React.FC<FacilitiesListViewProps> = ({
  farm,
  onBackToFarms,
  onOpenFacility,
  onOpenAddDeviceForFarm,
  onAddFacility,
}) => {
  const [showNewFacForm, setShowNewFacForm] = useState(false);
  const [facName, setFacName] = useState('');
  const [facCrop, setFacCrop] = useState(farm.crop);
  const [facType, setFacType] = useState<FacilityType>('greenhouse');
  const [facErr, setFacErr] = useState<string | null>(null);

  const totalControllers = farm.facilities.reduce(
    (sum, fac) => sum + fac.controllers.length,
    0
  );

  const handleCreateFacility = () => {
    setFacErr(null);
    const res = onAddFacility(farm.id, {
      name: facName,
      crop: facCrop,
      type: facType,
    });
    if (!res.ok) {
      setFacErr(res.error);
      return;
    }
    setFacName('');
    setShowNewFacForm(false);
  };

  return (
    <View style={styles.screenGap}>
      <View style={styles.rowBetweenCenter}>
        <TouchableOpacity onPress={onBackToFarms} style={styles.backLinkRow}>
          <ArrowLeft size={14} color="#15803D" />
          <Text style={styles.backLinkText}>All Farms</Text>
        </TouchableOpacity>
        <View style={[styles.pillBadge, { backgroundColor: '#DCFCE7' }]}>
          <Text style={[styles.pillBadgeText, { color: '#15803D' }]}>
            FACILITIES
          </Text>
        </View>
      </View>

      <View>
        <Text style={styles.sectionHeading}>{farm.name}</Text>
        <Text style={styles.mutedSmall}>
          {farm.location} · {farm.facilities.length} Facilities · {totalControllers}{' '}
          Controllers
        </Text>
      </View>

      <View style={styles.actionPairRow}>
        <TouchableOpacity
          style={[styles.secondaryOutlineBtn, { flex: 1, marginTop: 0 }]}
          onPress={() => setShowNewFacForm((v) => !v)}
        >
          <Plus size={14} color="#111827" />
          <Text style={styles.secondaryOutlineText}>Add Facility</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryDarkBtn, { flex: 1 }]}
          onPress={onOpenAddDeviceForFarm}
        >
          <Cpu size={14} color="#34D399" />
          <Text style={styles.primaryDarkBtnText}>Add Device</Text>
        </TouchableOpacity>
      </View>

      {showNewFacForm && (
        <View style={styles.whiteCard}>
          <Text style={[styles.cardSubTitle, { color: '#111827' }]}>
            New Facility in {farm.name}
          </Text>
          <Text style={styles.inputLabel}>Facility Name *</Text>
          <TextInput
            value={facName}
            onChangeText={setFacName}
            placeholder="e.g. Venlo Bay 03 · Nursery Expansion"
            placeholderTextColor="#9CA3AF"
            style={styles.textInput}
          />
          <Text style={[styles.inputLabel, { marginTop: 8 }]}>Facility Type</Text>
          <View style={styles.presetRow}>
            {(['greenhouse', 'polyhouse', 'beds', 'silos'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.presetBtn, facType === t && styles.presetBtnActive]}
                onPress={() => setFacType(t)}
              >
                <Text
                  style={[
                    styles.presetText,
                    facType === t && styles.presetTextActive,
                  ]}
                >
                  {FACILITY_TYPE_LABELS[t].split(' ')[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.inputLabel, { marginTop: 8 }]}>Crop / Usage</Text>
          <TextInput
            value={facCrop}
            onChangeText={setFacCrop}
            placeholder="e.g. Sweet Basil"
            placeholderTextColor="#9CA3AF"
            style={styles.textInput}
          />
          {facErr && <Text style={styles.errorText}>{facErr}</Text>}
          <TouchableOpacity
            style={[styles.primaryEmeraldBtn, { marginTop: 10 }]}
            onPress={handleCreateFacility}
          >
            <Text style={styles.primaryDarkBtnText}>Save Facility</Text>
          </TouchableOpacity>
        </View>
      )}

      {farm.facilities.map((fac) => {
        const hasAttention = fac.controllers.some((c) => c.status === 'ATTENTION');
        return (
          <TouchableOpacity
            key={fac.id}
            style={styles.listCard}
            onPress={() => onOpenFacility(fac.id)}
            activeOpacity={0.85}
          >
            <View style={styles.rowBetweenCenter}>
              <View style={[styles.rowGap8, { flex: 1 }]}>
                <View
                  style={[
                    styles.dotIndicator,
                    { backgroundColor: hasAttention ? '#D97706' : '#15803D' },
                  ]}
                />
                <Text style={[styles.farmTitle, { fontSize: 14.5, flex: 1 }]}>
                  {fac.name}
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color: hasAttention ? '#D97706' : '#15803D',
                }}
              >
                {fac.metrics.ec.toFixed(2)} mS
              </Text>
            </View>

            <Text style={styles.mutedSmall}>
              {FACILITY_TYPE_LABELS[fac.type]} · {fac.zone} · {fac.crop}
            </Text>

            <View style={styles.farmCardFooter}>
              <Text style={styles.farmMeta}>
                Target EC: {fac.metrics.targetEc.toFixed(1)} mS · pH{' '}
                {fac.metrics.ph.toFixed(2)}
              </Text>
              <View style={styles.drillBadge}>
                <Text style={styles.drillBadgeText}>
                  {fac.controllers.length} Ctrl
                </Text>
                <ChevronRight size={12} color="#34D399" />
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

interface ControllersListViewProps {
  farm: FarmEstate;
  facility: FacilityNode;
  selectedControllerId: string;
  onBackToFacilities: () => void;
  onJumpToFarms: () => void;
  onSelectController: (controllerId: string) => void;
  onLinkControllerToFacility: () => void;
}

export const ControllersListView: React.FC<ControllersListViewProps> = ({
  farm,
  facility,
  selectedControllerId,
  onBackToFacilities,
  onJumpToFarms,
  onSelectController,
  onLinkControllerToFacility,
}) => {
  return (
    <View style={styles.screenGap}>
      <View style={styles.rowBetweenCenter}>
        <TouchableOpacity onPress={onBackToFacilities} style={styles.backLinkRow}>
          <ArrowLeft size={14} color="#15803D" />
          <Text style={styles.backLinkText}>Back to Facilities</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onJumpToFarms} style={styles.crumbChip}>
          <Text style={styles.crumbChipText}>All Farms</Text>
        </TouchableOpacity>
      </View>

      <View>
        <Text style={styles.sectionHeading}>Controllers</Text>
        <Text style={styles.mutedSmall}>
          {farm.name} › {facility.name}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.primaryDarkBtn}
        onPress={onLinkControllerToFacility}
        activeOpacity={0.85}
      >
        <Plus size={15} color="#34D399" />
        <Text style={styles.primaryDarkBtnText}>
          Link / Add Controller to This Facility
        </Text>
      </TouchableOpacity>

      <Text style={styles.mutedSmall}>
        Choose a controller below to inspect its attached sensors and live dosing
        channels:
      </Text>

      {facility.controllers.map((ctrl) => {
        const isAttn = ctrl.status === 'ATTENTION';
        const isSel = ctrl.id === selectedControllerId;
        return (
          <TouchableOpacity
            key={ctrl.id}
            style={[styles.listCard, isSel && styles.listCardSelected]}
            onPress={() => onSelectController(ctrl.id)}
            activeOpacity={0.85}
          >
            <View style={styles.rowBetweenCenter}>
              <View style={[styles.rowGap8, { flex: 1 }]}>
                <View
                  style={[
                    styles.dotIndicator,
                    { backgroundColor: isAttn ? '#D97706' : '#15803D' },
                  ]}
                />
                <Text style={[styles.farmTitle, { fontSize: 15, flex: 1 }]}>
                  {ctrl.model}
                </Text>
              </View>
              <View
                style={[
                  styles.pillBadge,
                  { backgroundColor: isAttn ? '#FEF3C7' : '#DCFCE7' },
                ]}
              >
                <Text
                  style={[
                    styles.pillBadgeText,
                    { color: isAttn ? '#B45309' : '#15803D' },
                  ]}
                >
                  {ctrl.status}
                </Text>
              </View>
            </View>

            <View style={styles.rowBetweenCenter}>
              <Text style={styles.monoSmall}>
                Serial: {ctrl.serial} · FW {ctrl.firmware}
              </Text>
              <Text style={styles.mutedSmall}>
                {ctrl.linkMode === 'EDGE_TLS' ? 'Live Edge TLS' : 'Safe Demo'}
              </Text>
            </View>

            <View style={styles.farmCardFooter}>
              <Text style={styles.mutedSmall}>
                {ctrl.ipAddress} · {ctrl.rssi} dBm · {ctrl.doseCountHour} DC/h
              </Text>
              <View style={styles.drillBadge}>
                <Text style={styles.drillBadgeText}>
                  {ctrl.sensors.length} Sensors
                </Text>
                <ChevronRight size={12} color="#34D399" />
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

interface AddFarmViewProps {
  onBack: () => void;
  onCreateFarm: (
    input: AddFarmInput
  ) => { ok: true; farmId: string } | { ok: false; error: string };
}

export const AddFarmView: React.FC<AddFarmViewProps> = ({
  onBack,
  onCreateFarm,
}) => {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [crop, setCrop] = useState('');
  const [starterFacilityName, setStarterFacilityName] = useState(
    'Venlo Bay 01 · Starter Glasshouse'
  );
  const [template, setTemplate] = useState<'starter' | 'minimal'>('starter');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = () => {
    setErrorMsg(null);
    const res = onCreateFarm({
      name,
      location,
      crop,
      template,
      starterFacilityName,
    });
    if (!res.ok) {
      setErrorMsg(res.error);
    }
  };

  return (
    <View style={styles.screenGap}>
      <View style={styles.rowBetweenCenter}>
        <TouchableOpacity onPress={onBack} style={styles.backLinkRow}>
          <ArrowLeft size={14} color="#15803D" />
          <Text style={styles.backLinkText}>Back to Farms</Text>
        </TouchableOpacity>
        <View style={[styles.pillBadge, { backgroundColor: '#DCFCE7' }]}>
          <Text style={[styles.pillBadgeText, { color: '#15803D' }]}>
            NEW FARM / PLACE
          </Text>
        </View>
      </View>

      <View>
        <Text style={styles.sectionHeading}>Add Farm or Place</Text>
        <Text style={styles.mutedSmall}>
          Register a growing estate first, then inspect its facilities and link
          your controller hardware.
        </Text>
      </View>

      <View style={styles.whiteCard}>
        <Text style={styles.inputLabel}>Farm / Place Name *</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Johor Commercial Hydroponics"
          placeholderTextColor="#9CA3AF"
          style={styles.textInput}
        />

        <Text style={[styles.inputLabel, { marginTop: 10 }]}>
          Location / Region *
        </Text>
        <TextInput
          value={location}
          onChangeText={setLocation}
          placeholder="e.g. Kluang, Johor"
          placeholderTextColor="#9CA3AF"
          style={styles.textInput}
        />

        <Text style={[styles.inputLabel, { marginTop: 10 }]}>Primary Crop *</Text>
        <TextInput
          value={crop}
          onChangeText={setCrop}
          placeholder="e.g. Butterhead Lettuce & Sweet Basil"
          placeholderTextColor="#9CA3AF"
          style={styles.textInput}
        />

        <Text style={[styles.inputLabel, { marginTop: 10 }]}>
          First Facility Name
        </Text>
        <TextInput
          value={starterFacilityName}
          onChangeText={setStarterFacilityName}
          placeholder="e.g. Venlo Bay 01"
          placeholderTextColor="#9CA3AF"
          style={styles.textInput}
        />

        <Text style={[styles.inputLabel, { marginTop: 10 }]}>
          Initial Facility Preset
        </Text>
        <View style={styles.presetRow}>
          <TouchableOpacity
            style={[
              styles.presetBtn,
              template === 'starter' && styles.presetBtnActive,
            ]}
            onPress={() => setTemplate('starter')}
          >
            <Text
              style={[
                styles.presetText,
                template === 'starter' && styles.presetTextActive,
              ]}
            >
              Starter Glasshouse
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.presetBtn,
              template === 'minimal' && styles.presetBtnActive,
            ]}
            onPress={() => setTemplate('minimal')}
          >
            <Text
              style={[
                styles.presetText,
                template === 'minimal' && styles.presetTextActive,
              ]}
            >
              Minimal Hub
            </Text>
          </TouchableOpacity>
        </View>

        {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

        <TouchableOpacity
          style={[styles.primaryEmeraldBtn, { marginTop: 14 }]}
          onPress={handleSubmit}
        >
          <Plus size={15} color="#FFFFFF" />
          <Text style={styles.primaryDarkBtnText}>Create Farm Estate</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

interface AddDeviceViewProps {
  farms: FarmEstate[];
  initialFarmId: string;
  initialFacilityId: string;
  endpointUrl: string;
  hasToken: boolean;
  onBack: () => void;
  onLinkDevice: (
    input: LinkControllerInput
  ) => Promise<
    { ok: true; controllerId: string } | { ok: false; error: string }
  >;
  onOpenLinkedController?: () => void;
  onResetCredentials: () => Promise<void>;
  otaStatusMsg: string | null;
  isCheckingOta: boolean;
  onCheckOtaUpdate: () => Promise<void>;
}

export const AddDeviceView: React.FC<AddDeviceViewProps> = ({
  farms,
  initialFarmId,
  initialFacilityId,
  endpointUrl,
  hasToken,
  onBack,
  onLinkDevice,
  onOpenLinkedController,
  onResetCredentials,
  otaStatusMsg,
  isCheckingOta,
  onCheckOtaUpdate,
}) => {
  const [targetFarmId, setTargetFarmId] = useState(initialFarmId);
  const selectedFarmObj =
    farms.find((f) => f.id === targetFarmId) || farms[0];
  const [targetFacilityId, setTargetFacilityId] = useState(initialFacilityId);
  const [model, setModel] = useState<ControllerModel>('Autogrow EC Mini');
  const [serial, setSerial] = useState('AG-7104-NZ');
  const [urlInput, setUrlInput] = useState(endpointUrl);
  const [tokenInput, setTokenInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (
      selectedFarmObj &&
      !selectedFarmObj.facilities.some((fac) => fac.id === targetFacilityId)
    ) {
      if (selectedFarmObj.facilities[0]) {
        setTargetFacilityId(selectedFarmObj.facilities[0].id);
      }
    }
  }, [selectedFarmObj, targetFacilityId]);

  const handleSubmitLink = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    const res = await onLinkDevice({
      farmId: selectedFarmObj.id,
      facilityId: targetFacilityId,
      model,
      serial,
      endpointUrl: urlInput,
      token: tokenInput,
    });
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }
    setTokenInput('');
    setStatusMsg(
      urlInput.trim()
        ? 'Controller linked securely via TLS / Private LAN.'
        : 'Controller added in Safe Demo Simulation Mode.'
    );
  };

  const handleWipe = async () => {
    await onResetCredentials();
    setUrlInput('');
    setTokenInput('');
    setErrorMsg(null);
    setStatusMsg('Credentials cleared. Running in Safe Demo Mode.');
  };

  return (
    <View style={styles.screenGap}>
      <View style={styles.rowBetweenCenter}>
        <TouchableOpacity onPress={onBack} style={styles.backLinkRow}>
          <ArrowLeft size={14} color="#15803D" />
          <Text style={styles.backLinkText}>Back</Text>
        </TouchableOpacity>
        <View style={[styles.pillBadge, { backgroundColor: '#DCFCE7' }]}>
          <Text style={[styles.pillBadgeText, { color: '#15803D' }]}>
            TLS + SECURE STORE
          </Text>
        </View>
      </View>

      <View>
        <Text style={styles.sectionHeading}>Add & Link Controller Device</Text>
        <Text style={styles.mutedSmall}>
          Assign your hardware controller to a Farm and Facility, then link via
          HTTPS tunnel or private farm LAN.
        </Text>
      </View>

      {/* Farm & Facility Selector */}
      <View style={styles.whiteCard}>
        <Text style={styles.inputLabel}>1. Select Target Farm / Place</Text>
        <View style={[styles.presetRow, { marginBottom: 10 }]}>
          {farms.map((f) => {
            const active = f.id === selectedFarmObj.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.presetBtn, active && styles.presetBtnActive]}
                onPress={() => setTargetFarmId(f.id)}
              >
                <Text
                  style={[styles.presetText, active && styles.presetTextActive]}
                >
                  {f.name.split(' ')[0]} {f.name.split(' ')[1] || ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.inputLabel}>2. Select Target Facility</Text>
        <View style={[styles.presetRow, { marginBottom: 10 }]}>
          {selectedFarmObj.facilities.map((fac) => {
            const active = fac.id === targetFacilityId;
            return (
              <TouchableOpacity
                key={fac.id}
                style={[styles.presetBtn, active && styles.presetBtnActive]}
                onPress={() => setTargetFacilityId(fac.id)}
              >
                <Text
                  style={[styles.presetText, active && styles.presetTextActive]}
                >
                  {fac.name.split('·')[0].trim()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.inputLabel}>3. Controller Hardware Model</Text>
        <View style={[styles.presetRow, { marginBottom: 10 }]}>
          {CONTROLLER_MODELS.map((m) => {
            const active = m === model;
            return (
              <TouchableOpacity
                key={m}
                style={[styles.presetBtn, active && styles.presetBtnActive]}
                onPress={() => setModel(m)}
              >
                <Text
                  style={[styles.presetText, active && styles.presetTextActive]}
                >
                  {m.replace(' 16-Ch', '')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.inputLabel}>Controller Serial / Device ID *</Text>
        <TextInput
          value={serial}
          onChangeText={setSerial}
          placeholder="e.g. AG-8841-NZ"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="characters"
          autoCorrect={false}
          style={styles.textInput}
        />
      </View>

      {/* Edge Server Security & Credentials */}
      <View style={styles.whiteCard}>
        <View style={[styles.rowGap8, { marginBottom: 8 }]}>
          <ShieldCheck size={17} color="#15803D" />
          <Text style={{ fontSize: 13, fontWeight: '800', color: '#111827' }}>
            4. Edge Server Security Link
          </Text>
        </View>
        <Text
          style={{
            fontSize: 11,
            color: '#4B5563',
            lineHeight: 16,
            marginBottom: 10,
          }}
        >
          Public access requires HTTPS/WSS encryption. Tokens are stored in iOS
          Keychain / Android Keystore (never browser localStorage). Leave blank
          to register in Safe Demo Mode.
        </Text>

        <Text style={styles.inputLabel}>
          Edge Server URL (HTTPS or Private LAN)
        </Text>
        <TextInput
          value={urlInput}
          onChangeText={setUrlInput}
          placeholder="https://edge.yourfarm.com or http://192.168.1.50:8080"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.textInput}
        />

        <Text style={[styles.inputLabel, { marginTop: 10 }]}>
          Operator API Bearer Token{' '}
          {hasToken ? '(Saved in Vault)' : '(Optional)'}
        </Text>
        <TextInput
          value={tokenInput}
          onChangeText={setTokenInput}
          placeholder="Paste operator bearer token"
          placeholderTextColor="#9CA3AF"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.textInput}
        />

        {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
        {statusMsg && <Text style={styles.successText}>{statusMsg}</Text>}

        {statusMsg && onOpenLinkedController && (
          <TouchableOpacity
            style={[styles.primaryDarkBtn, { marginTop: 10 }]}
            onPress={onOpenLinkedController}
          >
            <Text style={styles.primaryDarkBtnText}>Inspect Linked Controller & Sensors</Text>
            <ChevronRight size={14} color="#34D399" />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.primaryEmeraldBtn, { marginTop: 12 }]}
          onPress={handleSubmitLink}
        >
          <Wifi size={15} color="#FFFFFF" />
          <Text style={styles.primaryDarkBtnText}>
            Save & Link Controller Device
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryOutlineBtn}
          onPress={handleWipe}
        >
          <Text style={styles.secondaryOutlineText}>
            Wipe Credentials & Use Safe Demo
          </Text>
        </TouchableOpacity>
      </View>

      {/* Expo Cloud CDN OTA Updater Card */}
      <View style={styles.whiteCard}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: '800',
            color: '#111827',
            marginBottom: 4,
          }}
        >
          App Version & Cloud OTA Updates
        </Text>
        <Text style={{ fontSize: 11.5, color: '#6B7280', marginBottom: 8 }}>
          Version 1.0.0 · Channel:{' '}
          {Updates.channel || (Platform.OS === 'web' ? 'web' : 'expo-go / local')}
        </Text>
        {otaStatusMsg && (
          <Text
            style={{
              fontSize: 11.5,
              fontWeight: '700',
              color: '#15803D',
              marginBottom: 8,
            }}
          >
            {otaStatusMsg}
          </Text>
        )}
        <TouchableOpacity
          style={[styles.secondaryOutlineBtn, { marginTop: 0 }]}
          disabled={isCheckingOta}
          onPress={onCheckOtaUpdate}
        >
          <Text style={styles.secondaryOutlineText}>
            {isCheckingOta ? 'Checking...' : 'Check for OTA Update'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
