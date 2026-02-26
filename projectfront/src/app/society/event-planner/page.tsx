'use client';

import { useState } from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import api from "@/lib/api";
import { useRouter } from "next/navigation";

export default function SocietyEventPlannerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [imagePreview, setImagePreview] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    organizerName: "CSE Society",
    eventType: "",
    eventDate: "",
    startTime: "",
    endTime: "",
    venue: "",
    speaker: "",
    description: "",
    eligibility: "",
    keyTopics: "",
    registrationDetails: "",
    benefits: "",
    contactInfo: "",
    category: "",
    maxParticipants: "",
    registrationDeadline: "",
    registrationFee: "0",
    organizerContact: "",
    bannerImage: ""
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle image file upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError("Please upload an image file (JPG, PNG, GIF)");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5MB");
      return;
    }

    setError("");

    // Create immediate local preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to server in background
    setUploadingImage(true);

    try {
      const formDataImage = new FormData();
      formDataImage.append('image', file);

      const response = await api.post('/upload/image', formDataImage, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        setFormData(prev => ({ ...prev, bannerImage: response.data.imageUrl }));
        // Keep the local preview, but store the server URL for submission
        setSuccess("Image uploaded successfully!");
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to upload image");
      // Clear preview on error
      setImagePreview("");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    // Validate banner image is uploaded
    if (!formData.bannerImage) {
      setError("Please upload a banner image before creating the event");
      setLoading(false);
      return;
    }

    console.log('Submitting event with data:', formData);

    try {
      const response = await api.post('/events', formData);
      
      if (response.data.success) {
        setSuccess("Event created successfully!");
        setTimeout(() => {
          router.push('/society');
        }, 2000);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create event. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      <PageHeader
        title="Create New Event"
        description="Fill in all the details to create an event that students can register for."
      />

      <SectionCard title="Event Details" description="Complete all required fields to publish your event.">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Success/Error Messages */}
          {success && (
            <div className="rounded-2xl border border-green-500/50 bg-green-50 p-4 text-sm text-green-700">
              {success}
            </div>
          )}
          {error && (
            <div className="rounded-2xl border border-red-500/50 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            {/* Event Title */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="title">Event Title *</Label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g., Innovation Week 2026"
                required
              />
            </div>

            {/* Organized By */}
            <div className="space-y-2">
              <Label htmlFor="organizerName">Organized By *</Label>
              <Input
                id="organizerName"
                name="organizerName"
                value={formData.organizerName}
                onChange={handleChange}
                placeholder="CSE Society"
                required
              />
            </div>

            {/* Event Type */}
            <div className="space-y-2">
              <Label htmlFor="eventType">Event Type *</Label>
              <select
                id="eventType"
                name="eventType"
                value={formData.eventType}
                onChange={handleChange}
                className="flex h-10 w-full rounded-2xl border border-border/70 bg-background px-4 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                required
              >
                <option value="">Select type</option>
                <option value="Workshop">Workshop</option>
                <option value="Seminar">Seminar</option>
                <option value="Competition">Competition</option>
                <option value="Hackathon">Hackathon</option>
                <option value="Conference">Conference</option>
                <option value="Cultural">Cultural Event</option>
                <option value="Sports">Sports Event</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="eventDate">Event Date *</Label>
              <Input
                id="eventDate"
                name="eventDate"
                type="date"
                value={formData.eventDate}
                onChange={handleChange}
                required
              />
            </div>

            {/* Start Time */}
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time *</Label>
              <Input
                id="startTime"
                name="startTime"
                type="time"
                value={formData.startTime}
                onChange={handleChange}
                required
              />
            </div>

            {/* End Time */}
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time *</Label>
              <Input
                id="endTime"
                name="endTime"
                type="time"
                value={formData.endTime}
                onChange={handleChange}
                required
              />
            </div>

            {/* Venue / Platform */}
            <div className="space-y-2">
              <Label htmlFor="venue">Venue / Platform *</Label>
              <Input
                id="venue"
                name="venue"
                value={formData.venue}
                onChange={handleChange}
                placeholder="e.g., Main Auditorium / Zoom"
                required
              />
            </div>

            {/* Speaker / Guest */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="speaker">Speaker / Guest (if any)</Label>
              <Input
                id="speaker"
                name="speaker"
                value={formData.speaker}
                onChange={handleChange}
                placeholder="e.g., Md. Eamin Rahman"
              />
            </div>

            {/* Short Event Description */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Short Event Description *</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Provide a brief overview of the event"
                rows={4}
                required
              />
            </div>

            {/* Eligibility */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="eligibility">Eligibility</Label>
              <Textarea
                id="eligibility"
                name="eligibility"
                value={formData.eligibility}
                onChange={handleChange}
                placeholder="e.g., Open to all CSE students, Year 2-4"
                rows={2}
              />
            </div>

            {/* Key Topics / Agenda */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="keyTopics">Key Topics / Agenda</Label>
              <Textarea
                id="keyTopics"
                name="keyTopics"
                value={formData.keyTopics}
                onChange={handleChange}
                placeholder="e.g., AI & Machine Learning, Cloud Computing, Web Development"
                rows={3}
              />
            </div>

            {/* Registration Details */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="registrationDetails">Registration Details</Label>
              <Textarea
                id="registrationDetails"
                name="registrationDetails"
                value={formData.registrationDetails}
                onChange={handleChange}
                placeholder="How to register, any prerequisites, documents needed, etc."
                rows={3}
              />
            </div>

            {/* Max Participants */}
            <div className="space-y-2">
              <Label htmlFor="maxParticipants">Max Participants</Label>
              <Input
                id="maxParticipants"
                name="maxParticipants"
                type="number"
                value={formData.maxParticipants}
                onChange={handleChange}
                placeholder="e.g., 100"
              />
            </div>

            {/* Registration Deadline */}
            <div className="space-y-2">
              <Label htmlFor="registrationDeadline">Registration Deadline</Label>
              <Input
                id="registrationDeadline"
                name="registrationDeadline"
                type="date"
                value={formData.registrationDeadline}
                onChange={handleChange}
              />
            </div>

            {/* Registration Fee */}
            <div className="space-y-2">
              <Label htmlFor="registrationFee">Registration Fee (৳)</Label>
              <Input
                id="registrationFee"
                name="registrationFee"
                type="number"
                value={formData.registrationFee}
                onChange={handleChange}
                placeholder="0"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                placeholder="e.g., Technical, Cultural, Sports"
              />
            </div>

            {/* Benefits / Perks */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="benefits">Benefits / Perks</Label>
              <Textarea
                id="benefits"
                name="benefits"
                value={formData.benefits}
                onChange={handleChange}
                placeholder="e.g., Certificate of participation, Networking opportunities, Prizes"
                rows={3}
              />
            </div>

            {/* Contact Information */}
            <div className="space-y-2">
              <Label htmlFor="organizerContact">Organizer Phone</Label>
              <Input
                id="organizerContact"
                name="organizerContact"
                value={formData.organizerContact}
                onChange={handleChange}
                placeholder="e.g., +88-1234567890"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactInfo">Contact Email</Label>
              <Input
                id="contactInfo"
                name="contactInfo"
                type="email"
                value={formData.contactInfo}
                onChange={handleChange}
                placeholder="e.g., abc@gmail.com"
              />
            </div>

            {/* Banner Image Upload */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="bannerImage">Event Banner Image *</Label>
              <div className="space-y-4">
                <Input
                  id="bannerImageFile"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">
                  Upload a banner image (Max 5MB, JPG/PNG/GIF recommended: 1200x600px)
                </p>
                
                {uploadingImage && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading image...
                  </div>
                )}
                
                {imagePreview && (
                  <div className="relative mt-4 overflow-hidden rounded-2xl border">
                    <img 
                      src={imagePreview} 
                      alt="Banner preview" 
                      className="h-64 w-full object-cover"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="absolute right-2 top-2"
                      onClick={() => {
                        setImagePreview("");
                        setFormData(prev => ({ ...prev, bannerImage: "" }));
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <Button type="submit" disabled={loading || uploadingImage}>
              {loading ? "Creating Event..." : "Create Event"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push('/society')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}

