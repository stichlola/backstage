import React, { createContext, useContext, useState, useRef, useCallback } from "react";

/* Sostituisce confirm/prompt/alert del browser con modali a tema.
   Uso: const dialog = useDialog();
        if (await dialog.confirm({ title, message, danger })) …
        const nome = await dialog.prompt({ title, message, initial });
        await dialog.alert({ title, message, copyText }); */

const Ctx = createContext(null);
export const useDialog = () => useContext(Ctx);

export function DialogProvider({ children }) {
  const [dlg, setDlg] = useState(null);
  const [value, setValue] = useState("");
  const resolver = useRef(null);

  const open = useCallback((cfg) => new Promise((resolve) => {
    resolver.current = resolve;
    setValue(cfg.initial || "");
    setDlg(cfg);
  }), []);

  const api = {
    confirm: (cfg) => open({ kind: "confirm", okLabel: "Conferma", cancelLabel: "Annulla", ...cfg }),
    prompt:  (cfg) => open({ kind: "prompt",  okLabel: "OK",       cancelLabel: "Annulla", ...cfg }),
    alert:   (cfg) => open({ kind: "alert",   okLabel: "OK", ...cfg }),
  };

  const close = (result) => { setDlg(null); resolver.current?.(result); resolver.current = null; };
  const ok = () => close(dlg.kind === "prompt" ? value : true);
  const cancel = () => close(dlg.kind === "prompt" ? null : dlg.kind === "confirm" ? false : undefined);

  return (
    <Ctx.Provider value={api}>
      {children}
      {dlg && (
        <div className="modal-bg dialog-bg" onClick={cancel} onKeyDown={(e) => e.key === "Escape" && cancel()}>
          <div className="modal dialog" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">{dlg.title}</h2>
            {dlg.message && <div className="dialog-message">{dlg.message}</div>}
            {dlg.kind === "prompt" && (
              <input className="dialog-input" autoFocus value={value} placeholder={dlg.placeholder || ""}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") ok(); if (e.key === "Escape") cancel(); }} />
            )}
            {dlg.copyText && (
              <input className="dialog-input mono" readOnly value={dlg.copyText} onFocus={(e) => e.target.select()} />
            )}
            <div className="modal-actions">
              {dlg.kind !== "alert" && <button className="btn btn-ghost" onClick={cancel}>{dlg.cancelLabel}</button>}
              <button className={"btn " + (dlg.danger ? "btn-danger" : "btn-primary")} autoFocus={dlg.kind !== "prompt"} onClick={ok}>
                {dlg.okLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
