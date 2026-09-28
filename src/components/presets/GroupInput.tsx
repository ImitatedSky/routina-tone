import { useId, type ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { MAX_GROUP_LENGTH } from '@/presets/presetFile'

interface Props extends Omit<ComponentProps<'input'>, 'list' | 'value' | 'onChange'> {
  value: string
  onChange: (value: string) => void
  groups: string[]
}

// 群組欄位：可以從既有群組挑，也可以直接打新的
export function GroupInput({ value, onChange, groups, ...props }: Props) {
  const listId = useId()
  return (
    <>
      <Input
        {...props}
        list={listId}
        maxLength={MAX_GROUP_LENGTH}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={listId}>
        {groups.map((group) => (
          <option key={group} value={group} />
        ))}
      </datalist>
    </>
  )
}
