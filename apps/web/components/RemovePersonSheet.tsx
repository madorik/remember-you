"use client";

import { useFormStatus } from "react-dom";
import { removeContact } from "@/app/actions/people";
import { Sheet } from "@/components/Sheet";

export interface RemoveLabels {
  open: string;
  title: string;
  body: string;
  remove: string;
  cancel: string;
  close: string;
}

function RemoveSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} aria-busy={pending} className="btn-soft !bg-red !text-white !shadow-none disabled:opacity-50 motion-safe:disabled:animate-pulse">
      {label}
    </button>
  );
}

/**
 * 사람 지우기 확인 시트: 바로 지우지 않고 아래에서 시트가 올라와 누구를 지우는지, 무엇이 사라지는지 한 번 더 보여 준다.
 * 처음 포커스는 취소(실수로 엔터를 쳐도 안 지워진다), 지우기는 빨강. 사람 화면 ··· 메뉴의 '지우기'가 연다(PersonMenu)
 */
export function RemovePersonSheet({ contactId, labels, onClose }: { contactId: string; labels: RemoveLabels; onClose: () => void }) {
  return (
    <Sheet
      id="remove-person-title"
      title={labels.title}
      closeLabel={labels.close}
      onClose={onClose}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button type="button" autoFocus onClick={onClose} className="btn-soft">
            {labels.cancel}
          </button>
          <form action={removeContact} className="contents">
            <input type="hidden" name="contactId" value={contactId} />
            <RemoveSubmit label={labels.remove} />
          </form>
        </div>
      }
    >
      <p className="px-6 pb-3 pt-1 text-[16.2px] leading-[1.6]">{labels.body}</p>
    </Sheet>
  );
}
