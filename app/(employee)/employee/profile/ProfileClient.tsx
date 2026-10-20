"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import Swal from "sweetalert2";
import {
  User,
  ShieldAlert,
  Loader2,
  Edit2,
  CheckCircle,
  X,
  MapPin,
  HeartHandshake,
  ChevronDown,
  Check,
  AlertCircle
} from "lucide-react";
import ProfilePhotoUploader from "./ProfilePhotoUploader";
import PasswordInputWithToggle from "@/app/components/PasswordInputWithToggle";
import { getProfileCompletion } from "@/lib/profile-completion";

type ProfileState = {
  fullName: string;
  email: string;
  profilePhotoUrl: string;
  phoneNumber: string;
  address: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
};

const swalCustomClass = {
  popup: "bg-surface-card rounded-2xl border border-line-subtle shadow-xl font-sans",
  title: "text-sm font-bold text-content-main",
  htmlContainer: "text-xs text-content-secondary",
  confirmButton: "px-4.5 py-2.5 text-xs font-bold rounded-xl text-white bg-brand-accent hover:bg-brand-hover border-none outline-none cursor-pointer transition",
};

const Toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 2500,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.onmouseenter = Swal.stopTimer;
    toast.onmouseleave = Swal.resumeTimer;
  },
});

async function uploadToCloudinary(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/employee/profile/photo", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `Photo upload failed (${res.status})`);
  }

  const data = (await res.json()) as { secure_url?: string };
  if (!data.secure_url) {
    throw new Error("Upload succeeded but no image URL was returned");
  }
  return data.secure_url;
}

export default function ProfileClient() {
  const genderRef = useRef<HTMLDivElement>(null);
  const maritalRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<ProfileState>({
    fullName: "",
    email: "",
    profilePhotoUrl: "",
    phoneNumber: "",
    address: "",
    dateOfBirth: "",
    gender: "",
    maritalStatus: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
  });

  const [tempProfile, setTempProfile] = useState<ProfileState>({ ...profile });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [isGenderOpen, setIsGenderOpen] = useState(false);
  const [isMaritalOpen, setIsMaritalOpen] = useState(false);

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [currentPasswordError, setCurrentPasswordError] = useState<string | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (genderRef.current && !genderRef.current.contains(target)) {
        setIsGenderOpen(false);
      }
      if (maritalRef.current && !maritalRef.current.contains(target)) {
        setIsMaritalOpen(false);
      }
    }

    if (isGenderOpen || isMaritalOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isGenderOpen, isMaritalOpen]);

  const sanitizeNumbersOnly = (value: string) => {
    return value.replace(/\D/g, "");
  };

  const completionPercentage = useMemo(
    () => getProfileCompletion(profile).percent,
    [profile]
  );

  const canSave = useMemo(() => {
    return !saving && !uploadingPhoto;
  }, [saving, uploadingPhoto]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/employee/profile", { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load profile (${res.status})`);
        const data = await res.json();

        const initialData = {
          fullName: data.fullName || "",
          email: data.email || "",
          profilePhotoUrl: data.profilePhotoUrl || "",
          phoneNumber: data.phoneNumber || "",
          address: data.address || "",
          dateOfBirth: data.dateOfBirth || "",
          gender: data.gender || "",
          maritalStatus: data.maritalStatus || "",
          emergencyContactName: data.emergencyContactName || "",
          emergencyContactPhone: data.emergencyContactPhone || "",
        };

        setProfile(initialData);
        setTempProfile(initialData);
      } catch (e) {
        console.error(e);
        Swal.fire({
          icon: "error",
          title: "Profile Data Retrieval Failed",
          text: e instanceof Error && e.message ? e.message : "Verify your connection or attempt again later.",
          confirmButtonColor: "#2563eb",
          customClass: swalCustomClass
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleStartEditing = () => {
    setTempProfile({ ...profile });
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setTempProfile({ ...profile });
    setIsEditing(false);
    setIsGenderOpen(false);
    setIsMaritalOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    try {
      setSaving(true);

      const payload = {
        profilePhotoUrl: tempProfile.profilePhotoUrl,
        phoneNumber: tempProfile.phoneNumber,
        address: tempProfile.address,
        dateOfBirth: tempProfile.dateOfBirth,
        gender: tempProfile.gender,
        maritalStatus: tempProfile.maritalStatus,
        emergencyContactName: tempProfile.emergencyContactName,
        emergencyContactPhone: tempProfile.emergencyContactPhone,
      };

      const res = await fetch("/api/employee/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Save failed (${res.status})`);
      }

      setProfile(tempProfile);
      setIsEditing(false);
      Toast.fire({
        icon: "success",
        title: "Profile details updated",
        customClass: {
          popup: "bg-surface-card border border-line-subtle rounded-2xl shadow-xl p-4 font-sans text-xs",
          title: "text-xs font-bold text-content-main",
        }
      });
    } catch (e) {
      console.error(e);
      Swal.fire({
        icon: "error",
        title: "Save Failed",
        text: e instanceof Error && e.message ? e.message : "Please check your inputs and try again.",
        confirmButtonColor: "#2563eb",
        customClass: swalCustomClass
      });
    } finally {
      setSaving(false);
    }
  };

  const onPhotoSelected = async (file: File) => {
    try {
      setUploadingPhoto(true);
      Toast.fire({ icon: "info", title: "Uploading photo..." });

      const url = await uploadToCloudinary(file);

      const saveRes = await fetch("/api/employee/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profilePhotoUrl: url }),
      });

      if (!saveRes.ok) {
        const data = await saveRes.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to save photo URL");
      }

      setTempProfile((p) => ({ ...p, profilePhotoUrl: url }));
      setProfile((p) => ({ ...p, profilePhotoUrl: url }));

      Toast.fire({
        icon: "success",
        title: "Photo saved successfully",
        customClass: {
          popup: "bg-surface-card border border-line-subtle rounded-2xl shadow-xl p-4 font-sans text-xs",
          title: "text-xs font-bold text-content-main",
        }
      });
    } catch (e) {
      console.error(e);
      Swal.fire({
        icon: "error",
        title: "Upload Failed",
        text: e instanceof Error && e.message ? e.message : "Photo update failed. Please try again.",
        confirmButtonColor: "#2563eb",
        customClass: swalCustomClass
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (uploadingPhoto) return;

    try {
      setUploadingPhoto(true);

      const saveRes = await fetch("/api/employee/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profilePhotoUrl: "" }),
      });

      if (!saveRes.ok) {
        const data = await saveRes.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to remove photo");
      }

      setTempProfile((p) => ({ ...p, profilePhotoUrl: "" }));
      setProfile((p) => ({ ...p, profilePhotoUrl: "" }));
      Toast.fire({
        icon: "success",
        title: "Photo removed",
        customClass: {
          popup: "bg-surface-card border border-line-subtle rounded-2xl shadow-xl p-4 font-sans text-xs",
          title: "text-xs font-bold text-content-main",
        }
      });
    } catch (e) {
      console.error(e);
      Swal.fire({
        icon: "error",
        title: "Failed to remove photo",
        text: e instanceof Error && e.message ? e.message : "Please try again.",
        confirmButtonColor: "#2563eb",
        customClass: swalCustomClass
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPasswordError(null);
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      Toast.fire({ icon: "warning", title: "Fill in all fields." });
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Swal.fire({
        icon: "error",
        title: "Validation Error",
        text: "New passwords do not match.",
        confirmButtonColor: "#2563eb",
        customClass: swalCustomClass
      });
      return;
    }

    if (passwordData.newPassword.length < 8) {
      Swal.fire({
        icon: "error",
        title: "Invalid Structure",
        text: "Password must be at least 8 characters in length.",
        confirmButtonColor: "#2563eb",
        customClass: swalCustomClass
      });
      return;
    }

    try {
      setPasswordSaving(true);
      const res = await fetch("/api/settings/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "employee",
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const message = errData?.message || errData?.error || "Failed to update password.";

        // Wrong old password → inline error on the field instead of only a popup
        if (res.status === 400 && /current password/i.test(message)) {
          setCurrentPasswordError("Current password is incorrect. Please try again.");
          return;
        }
        throw new Error(message);
      }

      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      Toast.fire({
        icon: "success",
        title: "Password changed successfully",
        customClass: {
          popup: "bg-surface-card border border-line-subtle rounded-2xl shadow-xl p-4 font-sans text-xs",
          title: "text-xs font-bold text-content-main",
        }
      });
    } catch (e) {
      console.error(e);
      Swal.fire({
        icon: "error",
        title: "Password Change Failed",
        text: e instanceof Error && e.message ? e.message : "Verify your current credentials and try again.",
        confirmButtonColor: "#2563eb",
        customClass: swalCustomClass
      });
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
        <span className="text-sm font-semibold text-content-secondary">Retrieving profile data...</span>
      </div>
    );
  }

  const initials = profile.fullName
    ? profile.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "EE";

  return (
    <div className={`space-y-6 pb-12 transition-all ${uploadingPhoto ? "cursor-wait select-none" : ""}`}>
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-line-subtle gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-content-main">
            Profile Settings
          </h1>
          <p className="mt-1 text-xs text-content-secondary">
            Keep your account and personal details updated.
          </p>
        </div>
        
        {/* Toggle Actions */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {!isEditing ? (
            <button
              type="button"
              onClick={handleStartEditing}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-accent hover:bg-brand-hover text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-[0.98] cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelEditing}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-subtle hover:bg-line-subtle text-brand-accent text-xs font-bold rounded-xl transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-accent hover:bg-brand-hover disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle className="w-3.5 h-3.5" />
                )}
                <span>{saving ? "Saving..." : "Save Changes"}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Left Side: Avatar & Completion Status */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-surface-card border border-line-subtle rounded-2xl p-5 shadow-xs flex flex-col items-center text-center">
            
            {/* Separated Profile Photo Component */}
            <ProfilePhotoUploader
              photoUrl={tempProfile.profilePhotoUrl}
              initials={initials}
              uploading={uploadingPhoto}
              onPhotoSelected={onPhotoSelected}
              onRemovePhoto={handleRemovePhoto}
            />

            <h2 className="mt-3 text-base font-bold text-content-main leading-tight">
              {profile.fullName || "User Account"}
            </h2>
            <span className="text-xs text-content-secondary font-medium mt-0.5">
              {profile.email}
            </span>

            {/* Completion Progress Bar */}
            <div className="w-full mt-4 pt-4 border-t border-line-subtle text-left">
              <div className="flex items-center justify-between text-[11px] font-bold text-content-secondary mb-1.5">
                <span>Profile Completion</span>
                <span className="text-brand-accent">{completionPercentage}%</span>
              </div>
              <div className="w-full bg-line-subtle/50 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-brand-accent h-1.5 rounded-full transition-all duration-500 ease-out" 
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>

            {/* Note Panel */}
            <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-left flex gap-2">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-[10px] text-amber-800 leading-relaxed font-medium">
                Full Name and Email are structurally locked. Contact HR to request alterations.
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Identity, Contact & Password Forms */}
        <div className="lg:col-span-8 space-y-4">
          <form onSubmit={handleSave} className="space-y-4">
            
            {/* General Identity */}
            <div className="bg-surface-card border border-line-subtle rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-line-subtle">
                <User className="w-4 h-4 text-brand-accent" />
                <h3 className="text-xs font-bold text-content-main tracking-wide uppercase">General Identity</h3>
              </div>

              {!isEditing ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-1">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">Date of Birth</span>
                    <span className="text-xs font-semibold text-content-main mt-0.5 block">
                      {profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString("en-US", { dateStyle: "medium" }) : "Not provided"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">Gender</span>
                    <span className="text-xs font-semibold text-content-main mt-0.5 block">{profile.gender || "Not provided"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">Marital Status</span>
                    <span className="text-xs font-semibold text-content-main mt-0.5 block">{profile.maritalStatus || "Not provided"}</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">Date of Birth</label>
                    <input
                      type="date"
                      value={tempProfile.dateOfBirth}
                      onChange={(e) => setTempProfile((p) => ({ ...p, dateOfBirth: e.target.value }))}
                      className="form-input text-xs cursor-pointer"
                    />
                  </div>

                  {/* Gender Dropdown */}
                  <div className="space-y-1 relative" ref={genderRef}>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">Gender</label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsGenderOpen(!isGenderOpen);
                        setIsMaritalOpen(false);
                      }}
                      className="w-full px-3 py-2 bg-surface-card border border-line-subtle rounded-xl text-xs text-content-main flex items-center justify-between text-left cursor-pointer"
                    >
                      <span>{tempProfile.gender || "Select Gender"}</span>
                      <ChevronDown className={`w-3.5 h-3.5 text-content-muted transition-transform duration-200 ${isGenderOpen ? "rotate-180" : ""}`} />
                    </button>

                    {isGenderOpen && (
                      <div className="dropdown-panel absolute left-0 right-0 mt-1.5 shadow-lg z-50">
                        {["Male", "Female", "Other"].map((gender) => (
                          <button
                            key={gender}
                            type="button"
                            onClick={() => {
                              setTempProfile((p) => ({ ...p, gender }));
                              setIsGenderOpen(false);
                            }}
                            className={`dropdown-option ${
                              tempProfile.gender === gender ? "dropdown-option-active" : ""
                            }`}
                          >
                            {gender}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Marital Status Dropdown */}
                  <div className="space-y-1 relative" ref={maritalRef}>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">Marital Status</label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMaritalOpen(!isMaritalOpen);
                        setIsGenderOpen(false);
                      }}
                      className="w-full px-3 py-2 bg-surface-card border border-line-subtle rounded-xl text-xs text-content-main flex items-center justify-between text-left cursor-pointer"
                    >
                      <span>{tempProfile.maritalStatus || "Select Status"}</span>
                      <ChevronDown className={`w-3.5 h-3.5 text-content-muted transition-transform duration-200 ${isMaritalOpen ? "rotate-180" : ""}`} />
                    </button>

                    {isMaritalOpen && (
                      <div className="dropdown-panel absolute left-0 right-0 mt-1.5 shadow-lg z-50">
                        {["Single", "Married", "Divorced", "Widowed"].map((status) => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => {
                              setTempProfile((p) => ({ ...p, maritalStatus: status }));
                              setIsMaritalOpen(false);
                            }}
                            className={`dropdown-option ${
                              tempProfile.maritalStatus === status ? "dropdown-option-active" : ""
                            }`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Contact Information */}
            <div className="bg-surface-card border border-line-subtle rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-line-subtle">
                <MapPin className="w-4 h-4 text-brand-accent" />
                <h3 className="text-xs font-bold text-content-main tracking-wide uppercase">Contact Coordinates</h3>
              </div>

              {!isEditing ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-1">
                  <div className="md:col-span-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">Phone Number</span>
                    <span className="text-xs font-semibold text-content-main mt-0.5 block">{profile.phoneNumber || "Not provided"}</span>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">Physical Address</span>
                    <span className="text-xs font-semibold text-content-main mt-0.5 block leading-relaxed">{profile.address || "Not provided"}</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1 md:col-span-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">Phone Number</label>
                    <input
                      type="tel"
                      placeholder="Numbers only"
                      value={tempProfile.phoneNumber}
                      onChange={(e) => setTempProfile((p) => ({ ...p, phoneNumber: sanitizeNumbersOnly(e.target.value) }))}
                      className="form-input text-xs"
                    />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">Physical Address</label>
                    <input
                      type="text"
                      placeholder="Resident coordinates..."
                      value={tempProfile.address}
                      onChange={(e) => setTempProfile((p) => ({ ...p, address: e.target.value }))}
                      className="form-input text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Emergency Contacts */}
            <div className="bg-surface-card border border-line-subtle rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-line-subtle">
                <HeartHandshake className="w-4 h-4 text-brand-accent" />
                <h3 className="text-xs font-bold text-content-main tracking-wide uppercase">Emergency Contact</h3>
              </div>

              {!isEditing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-1">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">Contact Person</span>
                    <span className="text-xs font-semibold text-content-main mt-0.5 block">{profile.emergencyContactName || "Not provided"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">Contact Number</span>
                    <span className="text-xs font-semibold text-content-main mt-0.5 block">{profile.emergencyContactPhone || "Not provided"}</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">Contact Person Name</label>
                    <input
                      type="text"
                      placeholder="Kin name..."
                      value={tempProfile.emergencyContactName}
                      onChange={(e) => setTempProfile((p) => ({ ...p, emergencyContactName: e.target.value }))}
                      className="form-input text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted block">Contact Phone Number</label>
                    <input
                      type="tel"
                      placeholder="Numbers only"
                      value={tempProfile.emergencyContactPhone}
                      onChange={(e) => setTempProfile((p) => ({ ...p, emergencyContactPhone: sanitizeNumbersOnly(e.target.value) }))}
                      className="form-input text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          </form>

          {/* Password Modification Panel */}
          <div className="bg-surface-card border border-line-subtle rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-line-subtle">
              <ShieldAlert className="w-4 h-4 text-brand-accent" />
              <h3 className="text-xs font-bold text-content-main tracking-wide uppercase">Security & Credentials</h3>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <PasswordInputWithToggle
                    label="Current Password"
                    placeholder="Enter current password"
                    value={passwordData.currentPassword}
                    onChange={(val) => {
                      setCurrentPasswordError(null);
                      setPasswordData((p) => ({ ...p, currentPassword: val }));
                    }}
                    disabled={passwordSaving}
                    inputClassName={`form-input text-xs ${
                      currentPasswordError ? "border-rose-400 focus:border-rose-400 focus:ring-rose-200" : ""
                    }`}
                  />
                  {currentPasswordError && (
                    <p className="flex items-center gap-1 text-[10px] font-semibold text-rose-600">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {currentPasswordError}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <PasswordInputWithToggle
                    label="New Password"
                    placeholder="Min. 8 characters"
                    value={passwordData.newPassword}
                    onChange={(val) => setPasswordData((p) => ({ ...p, newPassword: val }))}
                    disabled={passwordSaving}
                    inputClassName="form-input text-xs"
                  />
                  {passwordData.newPassword.length > 0 && passwordData.newPassword.length < 8 && (
                    <p className="flex items-center gap-1 text-[10px] font-semibold text-amber-600">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      At least 8 characters required
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <PasswordInputWithToggle
                    label="Confirm Password"
                    placeholder="Re-enter password"
                    value={passwordData.confirmPassword}
                    onChange={(val) => setPasswordData((p) => ({ ...p, confirmPassword: val }))}
                    disabled={passwordSaving}
                    inputClassName={`form-input text-xs ${
                      passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword
                        ? "border-rose-400 focus:border-rose-400 focus:ring-rose-200"
                        : ""
                    }`}
                  />
                  {passwordData.confirmPassword.length > 0 &&
                    (passwordData.newPassword === passwordData.confirmPassword ? (
                      <p className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                        <Check className="w-3 h-3 shrink-0" />
                        Passwords match
                      </p>
                    ) : (
                      <p className="flex items-center gap-1 text-[10px] font-semibold text-rose-600">
                        <X className="w-3 h-3 shrink-0" />
                        Passwords do not match
                      </p>
                    ))}
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-line-subtle">
                <button
                  type="submit"
                  disabled={
                    passwordSaving ||
                    (passwordData.confirmPassword.length > 0 &&
                      passwordData.newPassword !== passwordData.confirmPassword)
                  }
                  className="inline-flex items-center gap-1.5 px-4.5 py-2.5 text-xs font-bold text-white bg-brand-accent hover:bg-brand-hover rounded-xl shadow-xs transition duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {passwordSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldAlert className="w-3.5 h-3.5" />
                  )}
                  <span>{passwordSaving ? "Updating..." : "Update Password"}</span>
                </button>
              </div>
            </form>
          </div>

        </div>

      </div>
    </div>
  );
}