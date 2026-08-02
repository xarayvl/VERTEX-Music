import React from 'react';
import { ProfileModal } from './ProfileModal';
import { UserProfile, Track } from '../../types';

interface ProfileAndPremiumModalProps {
  isOpen: boolean;
  initialTab?: 'profile' | 'premium';
  userProfile: UserProfile | null;
  onClose: () => void;
  onUpdateProfile: (updated: UserProfile) => void;
  recentTracks?: Track[];
  onPlayTrack?: (track: Track) => void;
  onLogout?: () => void;
  onOpenAuthModal?: () => void;
}

export const ProfileAndPremiumModal: React.FC<ProfileAndPremiumModalProps> = (props) => {
  return <ProfileModal {...props} />;
};
