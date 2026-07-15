"use client";

import { Button } from "@/components/ui/button";

interface RegistrantRow {
  id: string;
  userName: string;
  registrationNumber?: string;
}

interface EventRegistrationsListModalProps {
  eventTitle: string;
  totalRegistrations: number | null;
  registrants: RegistrantRow[];
  isLoading: boolean;
  error: string;
  onClose: () => void;
}

export function EventRegistrationsListModal({
  eventTitle,
  totalRegistrations,
  registrants,
  isLoading,
  error,
  onClose,
}: EventRegistrationsListModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border/70 bg-background p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{eventTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Registered students</p>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading registrations...</p>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm font-medium text-foreground">
              Total registered: {totalRegistrations ?? registrants.length}
            </p>

            {registrants.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No students have registered for this event yet.
              </p>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border/70">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-2 font-medium text-foreground">#</th>
                      <th className="px-4 py-2 font-medium text-foreground">Name</th>
                      <th className="px-4 py-2 font-medium text-foreground">Registration No.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrants.map((registrant, index) => (
                      <tr key={registrant.id} className="border-t border-border/70">
                        <td className="px-4 py-2 text-muted-foreground">{index + 1}</td>
                        <td className="px-4 py-2 text-foreground">{registrant.userName}</td>
                        <td className="px-4 py-2 text-foreground">
                          {registrant.registrationNumber || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
