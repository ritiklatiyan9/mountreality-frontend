import {
  Children,
  cloneElement,
  isValidElement,
  useId,
} from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useFieldPolicy } from '@/hooks/useFieldPolicy';

/**
 * Presentation wrapper for a policy-controlled field.
 *
 * Hiding a field returns null without calling any setter, so the form owner
 * retains existing values. A render function is recommended for non-native
 * controls that need custom read-only behavior.
 */
export function PolicyField({
  fieldId,
  field,
  id,
  label,
  required = false,
  readOnly = false,
  helpText = null,
  hideLabel = false,
  render,
  children,
  className,
  labelClassName,
  helpClassName,
}) {
  const stableFieldId = fieldId ?? field;
  const policy = useFieldPolicy(stableFieldId, {
    label: label ?? null,
    required,
    readOnly,
    helpText,
  });
  const generatedId = useId().replace(/:/g, '');

  if (!policy.visible) return null;

  const onlyChild = Children.count(children) === 1 && isValidElement(children)
    ? Children.only(children)
    : null;
  const controlId = id ?? onlyChild?.props?.id ?? `policy-field-${generatedId}`;
  const descriptionId = policy.helpText ? `${controlId}-help` : undefined;
  const effectiveReadOnly = Boolean(readOnly || onlyChild?.props?.readOnly || policy.readOnly);
  const effectiveRequired = Boolean(policy.required);
  const effectiveLabel = policy.label ?? label;
  const describedBy = [onlyChild?.props?.['aria-describedby'], descriptionId]
    .filter(Boolean)
    .join(' ') || undefined;

  const controlProps = {
    id: controlId,
    readOnly: effectiveReadOnly,
    required: effectiveRequired,
    'aria-readonly': effectiveReadOnly || undefined,
    'aria-required': effectiveRequired || undefined,
    'aria-describedby': describedBy,
  };

  const renderContext = {
    ...policy,
    id: controlId,
    label: effectiveLabel,
    required: effectiveRequired,
    readOnly: effectiveReadOnly,
    helpText: policy.helpText,
    controlProps,
    policy,
  };

  let control = children;
  if (typeof render === 'function') control = render(renderContext);
  else if (typeof children === 'function') control = children(renderContext);
  else if (onlyChild) control = cloneElement(onlyChild, controlProps);

  return (
    <div className={cn('min-w-0', className)} data-policy-field={stableFieldId || undefined}>
      {!hideLabel && effectiveLabel && (
        <Label
          htmlFor={controlId}
          className={cn('mb-1.5 block text-[13px] font-medium text-mr-text', labelClassName)}
        >
          {effectiveLabel}
          {effectiveRequired && (
            <span className="ml-0.5 text-mr-coral-ink" aria-hidden="true">*</span>
          )}
          {effectiveRequired && <span className="sr-only"> (required)</span>}
        </Label>
      )}

      {control}

      {policy.helpText && (
        <p
          id={descriptionId}
          className={cn('mt-1.5 text-[12px] leading-relaxed text-mr-muted', helpClassName)}
        >
          {policy.helpText}
        </p>
      )}
    </div>
  );
}

export default PolicyField;

