import { renderHook } from '@testing-library/react-native';

import { finishPicking, getPickedItems, startPicking, usePickedItemsListener } from '@/features/wardrobe/selection';

describe('parça seçimi', () => {
  it('seçimi yalnızca seçiciyi açan ekrana iletir', async () => {
    const create = jest.fn();
    const edit = jest.fn();
    await renderHook(() => usePickedItemsListener('create', create));
    await renderHook(() => usePickedItemsListener('edit-1', edit));

    startPicking('edit-1', ['a']);
    expect(getPickedItems()).toEqual(['a']);
    finishPicking(['a', 'b']);

    expect(edit).toHaveBeenCalledWith(['a', 'b']);
    expect(create).not.toHaveBeenCalled();
  });

  it('seçici açılmadan gelen sonuç kimseye iletilmez', async () => {
    const create = jest.fn();
    await renderHook(() => usePickedItemsListener('create', create));
    finishPicking(['x']);
    expect(create).not.toHaveBeenCalled();
  });
});
